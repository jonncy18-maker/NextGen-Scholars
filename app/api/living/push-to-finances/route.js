import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';
import { mapCategories, buildProposal, bucketFor } from '../../../../lib/ai/push-to-finances.js';
import { EXPENSE_CATS } from '../../../../src/constants.js';
import { expandLine, isMonthKey } from '../../../../src/recurrence.js';

// Scoped per-caller — never cached. See lib/http.js's json().
export const dynamic = 'force-dynamic';

// Every row this flow writes carries this group_id, so a re-push for the same
// scholar+month can replace its own previous output without touching a single
// expense the mentor entered by hand.
function groupIdFor(scholar, month) {
  return `living:${scholar}:${month}`;
}

// ── GET ?scholar=&month= — propose the mapping ─────────────────────────────
// Mentor-only: this reads one scholar's budget and proposes writes into the
// PROGRAM ledger, which is the mentor's book, not the scholar's.
export const GET = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { searchParams } = new URL(request.url);
  const scholar = searchParams.get('scholar');
  const month = searchParams.get('month');

  if (!scholar) return json({ error: 'scholar required' }, { status: 400 });
  if (!isMonthKey(month)) return json({ error: 'month must be YYYY-MM' }, { status: 400 });

  const [scholarRow] = await sql`
    select scholar_key, first_name, current_sem from scholars where scholar_key = ${scholar}
  `;
  if (!scholarRow) return json({ error: 'Unknown scholar' }, { status: 404 });

  const categories = await sql`
    select id, name, kind, rollup from living_category
    where scholar = ${scholar} and archived_at is null
    order by sort_order, name
  `;
  const planRows = await sql`
    select category_id, planned_php from living_plan
    where scholar = ${scholar} and month = ${month}
  `;
  const planMap = new Map(planRows.map((r) => [r.category_id, Number(r.planned_php) || 0]));

  // Degrades to the deterministic rollup map when Claude is unavailable —
  // mapCategories never throws. The mentor approves either way.
  const aiMap = await mapCategories(
    categories.filter((c) => (planMap.get(c.id) || 0) > 0),
    process.env.ANTHROPIC_API_KEY
  );

  const rows = buildProposal(categories, planMap, aiMap);

  // What a confirm would REPLACE, surfaced up front so the mentor is never
  // surprised by a delete. Two sources: this flow's own previous push, and
  // the single lump-sum allowance expense row for the month (the documented
  // sole join between the two ledgers — see db/living_budget.sql).
  const priorPushed = await sql`
    select id, item, cat, amount, date from expenses
    where scholar = ${scholar} and group_id = ${groupIdFor(scholar, month)}
    order by date
  `;
  const [allowanceRow] = await sql`
    select a.id, a.expense_id, e.item, e.amount, e.date
    from allowance a left join expenses e on e.id = a.expense_id
    where a.scholar = ${scholar} and a.month = ${month}
  `;

  return json({
    scholar: scholarRow.scholar_key,
    scholarName: scholarRow.first_name,
    sem: scholarRow.current_sem,
    month,
    rows,
    total: rows.reduce((s, r) => s + r.amount_php, 0),
    aiUsed: aiMap.size > 0,
    replaces: {
      pushed: priorPushed,
      allowance: allowanceRow?.expense_id
        ? {
            expense_id: allowanceRow.expense_id,
            item: allowanceRow.item,
            amount: allowanceRow.amount,
            date: allowanceRow.date,
          }
        : null,
    },
  });
});

// ── POST — write the approved rows ─────────────────────────────────────────
// Body: { scholar, month, sem, lines: [{ category_id, item, cat, amount_php,
//         schedule: { mode, date|weekday|dayOfMonth } }] }
//
// The model's/client's arguments are untrusted: the category is re-validated
// against EXPENSE_CATS, the bucket is re-derived (never accepted), and the
// dates are re-expanded server-side from the schedule rather than taken from
// the client — same rule lib/ai/tools.js follows.
export const POST = withErrorHandling(async (request) => {
  await requireMentor(request);
  const body = await request.json();

  const scholar = String(body.scholar || '');
  const month = String(body.month || '');
  if (!scholar) return json({ error: 'scholar required' }, { status: 400 });
  if (!isMonthKey(month)) return json({ error: 'month must be YYYY-MM' }, { status: 400 });

  const [scholarRow] = await sql`
    select scholar_key, current_sem from scholars where scholar_key = ${scholar}
  `;
  if (!scholarRow) return json({ error: 'Unknown scholar' }, { status: 404 });
  const sem = String(body.sem || scholarRow.current_sem || '');

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return json({ error: 'No lines to push' }, { status: 400 });

  // Expand everything BEFORE writing anything: a line with an unresolvable
  // schedule must fail the whole request, not leave a half-pushed month that
  // silently under-reports her spending.
  const planned = [];
  for (const line of lines) {
    const cat = String(line.cat || '');
    if (!EXPENSE_CATS.includes(cat)) {
      return json({ error: `Unknown expense category: ${cat}` }, { status: 400 });
    }
    const amount = Math.round(Number(line.amount_php) || 0);
    if (amount <= 0) {
      return json({ error: `Amount must be positive for ${line.item || cat}` }, { status: 400 });
    }
    const parts = expandLine(month, { amount_php: amount, schedule: line.schedule });
    if (!parts.length) {
      return json(
        { error: `Set a date for "${line.item || cat}" before pushing` },
        { status: 400 }
      );
    }
    const item = String(line.item || cat).slice(0, 200);
    for (const p of parts) {
      planned.push({ item, cat, bucket: bucketFor(cat), amount: p.amount, date: p.date });
    }
  }

  const groupId = groupIdFor(scholar, month);

  // Replace, never add — the whole point of the double-count rule. Both of
  // these represent the SAME money as the rows about to be inserted: a prior
  // push of this month, and the lump-sum allowance outflow this itemisation
  // supersedes. allowance.expense_id is ON DELETE SET NULL, so dropping the
  // expense clears the link on its own.
  await sql`delete from expenses where scholar = ${scholar} and group_id = ${groupId}`;

  const [allowanceRow] = await sql`
    select expense_id from allowance where scholar = ${scholar} and month = ${month}
  `;
  let replacedAllowance = false;
  if (allowanceRow?.expense_id) {
    await sql`delete from expenses where id = ${allowanceRow.expense_id}`;
    replacedAllowance = true;
  }

  const inserted = [];
  for (const [i, row] of planned.entries()) {
    const id = `${scholar}_${month}_push_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    const [saved] = await sql`
      insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
      values (${id}, ${scholar}, ${sem}, ${row.item}, ${row.cat}, ${row.bucket},
              ${row.amount}, 1, ${row.date}, 'Actual', 'No', '', ${groupId})
      returning *
    `;
    inserted.push(saved);
  }

  return json(
    {
      inserted: inserted.length,
      total: inserted.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      replacedAllowance,
      rows: inserted,
    },
    { status: 201 }
  );
});
