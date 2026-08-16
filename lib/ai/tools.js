// Tool registry — the AI's hands.
//
// Every operation a signed-in human can perform through the UI has exactly one
// entry here, so "what the AI can do" and "what you can do manually" stay the
// same list. Each entry declares:
//
//   roles      which signed-in roles may call it ('mentor' and/or 'scholar')
//   mutates    true = writes to Neon. Mutating tools are NEVER executed inside
//              the model loop — the agent stops and returns a proposal card,
//              and only an explicit user confirm (a second request to
//              app/api/agent) runs them. Read tools run freely in-loop.
//   parameters Gemini function-declaration schema (OpenAPI subset — no
//              additionalProperties, so free-form JSON blobs are passed as
//              STRING and parsed here).
//   summarize  one-line plain-English preview shown on the confirm card
//   run        the handler, given ({ role, scholarKey })
//
// Scoping rule, enforced in every handler rather than trusted from the model:
// a scholar-role caller is pinned to their own scholar_key no matter what the
// model put in `args.scholar`, exactly as the equivalent route handlers under
// app/api/** do. The model's arguments are untrusted input — it is reading
// free text that may itself have come from a receipt or a scholar's message.

import { sql } from '../db.js';
import { CAT_TO_BUCKET, EXPENSE_CATS, SEMESTER_OPTIONS } from '../../src/constants.js';
import { buildContext } from './context.js';

// ── helpers ──────────────────────────────────────────────────────────────────

class ToolError extends Error {}

// Mentor may act on any scholar (and must name one); a scholar is pinned to
// their own key regardless of what the model proposed.
function scopeScholar({ role, scholarKey }, requested) {
  if (role === 'scholar') {
    if (!scholarKey) throw new ToolError('No scholar_key on your profile.');
    return scholarKey;
  }
  if (!requested) throw new ToolError('This action needs a scholar — say which one.');
  return requested;
}

// Free-form JSON blobs travel as strings (Gemini's schema subset has no
// open-ended object type). Objects are passed through untouched so the
// confirm-and-execute round trip, which re-sends already-parsed args, works too.
function parseJson(value, label) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new ToolError(`${label} must be valid JSON.`);
  }
}

function requireCat(cat) {
  if (!cat) return 'Other';
  const match = EXPENSE_CATS.find((c) => c.toLowerCase() === String(cat).toLowerCase());
  if (!match) throw new ToolError(`Unknown category "${cat}". Valid: ${EXPENSE_CATS.join(', ')}`);
  return match;
}

function requireSem(sem) {
  if (!sem) throw new ToolError('A semester is required.');
  const match = SEMESTER_OPTIONS.find((s) => s.toLowerCase() === String(sem).toLowerCase());
  if (!match) throw new ToolError(`Unknown semester "${sem}". Valid: ${SEMESTER_OPTIONS.join(', ')}`);
  return match;
}

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

// Neon returns NUMERIC as strings — same coercion the grades routes do, so the
// model reasons over numbers rather than quoted decimals.
const GRADE_NUMERICS = ['units', 'prelim', 'midterm', 'final_grade', 'period_avg', 'pct_equiv'];
function coerceGrades(rows) {
  return rows.map((r) => {
    const out = { ...r };
    for (const c of GRADE_NUMERICS) if (out[c] != null) out[c] = Number(out[c]);
    return out;
  });
}

// Schema shorthand
const S = (description) => ({ type: 'STRING', description });
const N = (description) => ({ type: 'NUMBER', description });
const B = (description) => ({ type: 'BOOLEAN', description });
const obj = (properties, required = []) => ({ type: 'OBJECT', properties, required });

const SCHOLAR_ARG = S('Scholar key (e.g. "claire"). Ignored for scholar-role callers — they can only act on themselves.');

// ── read tools ───────────────────────────────────────────────────────────────

const READ_TOOLS = [
  {
    name: 'list_scholars',
    roles: ['mentor'],
    description: 'List every scholar with their key, name, track, current semester and GPA floor.',
    parameters: obj({}),
    run: async () => sql`select scholar_key, name, track, program, status, current_sem, gpa_floor from scholars order by scholar_key`,
  },
  {
    name: 'get_scholar_snapshot',
    roles: ['mentor', 'scholar'],
    description:
      'Full context bundle for one scholar: profile, academics, expense totals by semester and category, budget, milestones, alerts, deadlines, open actions, English progress and pending submissions. Call this first for any broad question.',
    parameters: obj({ scholar: SCHOLAR_ARG }),
    run: async (a, ctx) => buildContext(scopeScholar(ctx, a.scholar)),
  },
  {
    name: 'list_expenses',
    roles: ['mentor', 'scholar'],
    description:
      'Saved expense rows, newest first. Filter by scholar, semester, bucket, category or unsent-only. Use this to find the id of a row before editing or deleting it.',
    parameters: obj({
      scholar: SCHOLAR_ARG,
      sem: S('Semester code, e.g. "Y1S1".'),
      bucket: S('college | milestone | travel | life | exam | professional | admin'),
      cat: S('Expense category.'),
      unsent_only: B('Only rows not yet marked as sent.'),
      limit: N('Max rows (default 50).'),
    }),
    run: async (a, ctx) => {
      const scholar = ctx.role === 'scholar' ? ctx.scholarKey : a.scholar || null;
      const conds = [];
      const vals = [];
      const add = (frag, v) => { vals.push(v); conds.push(frag.replace('?', `$${vals.length}`)); };
      if (scholar) add('scholar = ?', scholar);
      if (a.sem) add('sem = ?', a.sem);
      if (a.bucket) add('bucket = ?', a.bucket);
      if (a.cat) add('cat = ?', a.cat);
      if (a.unsent_only) conds.push("coalesce(sent, '') <> 'Yes'");
      const where = conds.length ? `where ${conds.join(' and ')}` : '';
      vals.push(Math.min(Number(a.limit) || 50, 200));
      return sql.query(
        `select id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor from expenses ${where} order by date desc limit $${vals.length}`,
        vals
      );
    },
  },
  {
    name: 'list_grades',
    roles: ['mentor', 'scholar'],
    description: 'Grade entries (subject, units, prelim, midterm, final, computed average) for a scholar, optionally one semester.',
    parameters: obj({ scholar: SCHOLAR_ARG, sem: S('Semester code.') }),
    run: async (a, ctx) => {
      const scholar = ctx.role === 'scholar' ? ctx.scholarKey : a.scholar || null;
      const rows = scholar && a.sem
        ? await sql`select * from grade_entries where scholar = ${scholar} and sem = ${a.sem} order by created_at`
        : scholar
          ? await sql`select * from grade_entries where scholar = ${scholar} order by sem, created_at`
          : await sql`select * from grade_entries order by scholar, sem, created_at`;
      return coerceGrades(rows);
    },
  },
  {
    name: 'list_english_periods',
    roles: ['mentor', 'scholar'],
    description: 'English study periods (label, session type, date range, hour goal, weekly targets) for a scholar.',
    parameters: obj({ scholar: SCHOLAR_ARG }),
    run: async (a, ctx) => {
      const scholar = ctx.role === 'scholar' ? ctx.scholarKey : a.scholar || null;
      return scholar
        ? sql`select * from english_periods where scholar = ${scholar} order by start_date desc`
        : sql`select * from english_periods order by start_date desc`;
    },
  },
  {
    name: 'list_english_sessions',
    roles: ['mentor', 'scholar'],
    description: 'Logged English study sessions, newest first. Use to find a session id before editing or deleting it.',
    parameters: obj({
      scholar: SCHOLAR_ARG,
      from: S('Start date, YYYY-MM-DD.'),
      to: S('End date, YYYY-MM-DD.'),
      limit: N('Max rows (default 50).'),
    }),
    run: async (a, ctx) => {
      const scholar = ctx.role === 'scholar' ? ctx.scholarKey : a.scholar || null;
      const conds = [];
      const vals = [];
      const add = (frag, v) => { vals.push(v); conds.push(frag.replace('?', `$${vals.length}`)); };
      if (scholar) add('scholar = ?', scholar);
      if (a.from) add('date >= ?', a.from);
      if (a.to) add('date <= ?', a.to);
      const where = conds.length ? `where ${conds.join(' and ')}` : '';
      vals.push(Math.min(Number(a.limit) || 50, 200));
      return sql.query(`select * from english_sessions ${where} order by date desc limit $${vals.length}`, vals);
    },
  },
  {
    name: 'list_submissions',
    roles: ['mentor', 'scholar'],
    description:
      'Expense submissions awaiting or past mentor review. A mentor sees every scholar\'s; a scholar sees only their own. Use to find a submission id before approving or rejecting.',
    parameters: obj({ status: S('pending | approved | rejected | resubmitted. Defaults to pending.') }),
    run: async (a, ctx) => {
      const status = a.status || 'pending';
      return ctx.role === 'scholar'
        ? sql`select * from expense_submissions where scholar_key = ${ctx.scholarKey} and status = ${status} order by created_at desc`
        : sql`select * from expense_submissions where status = ${status} order by created_at desc`;
    },
  },
  {
    name: 'list_actions',
    roles: ['mentor'],
    description: 'Mentor action items. Defaults to open (not done) items only.',
    parameters: obj({ include_done: B('Include completed items too.') }),
    run: async (a) =>
      a.include_done
        ? sql`select * from actions order by done, id`
        : sql`select * from actions where done = false order by id`,
  },
  {
    name: 'list_alerts',
    roles: ['mentor'],
    description: 'Active alerts across the cohort. Use to find an alert id before dismissing it.',
    parameters: obj({}),
    run: async () => sql`select * from alerts order by created_at desc`,
  },
  {
    name: 'list_career_steps',
    roles: ['mentor', 'scholar'],
    description: 'Licensure pathway steps (PNLE → OET → NCLEX → OSCE → AHPRA) with status, exam date and score.',
    parameters: obj({ scholar: SCHOLAR_ARG }),
    run: async (a, ctx) => {
      const scholar = ctx.role === 'scholar' ? ctx.scholarKey : a.scholar || null;
      return scholar
        ? sql`select * from career_steps where scholar = ${scholar} order by step`
        : sql`select * from career_steps order by scholar, step`;
    },
  },
  {
    name: 'get_config',
    roles: ['mentor'],
    description: 'Read one program-config value by key (e.g. the public program-details copy).',
    parameters: obj({ key: S('Config key.') }, ['key']),
    run: async (a) => {
      const [row] = await sql`select key, value from config where key = ${a.key}`;
      return row ?? null;
    },
  },
];

// ── write tools ──────────────────────────────────────────────────────────────

const WRITE_TOOLS = [
  // Expenses ─────────────────────────────────────────────────────────────────
  {
    name: 'add_expense',
    roles: ['mentor'],
    description: 'Save a new expense row directly (mentor only — this is the mentor-entered path, not the scholar submission queue).',
    parameters: obj(
      {
        scholar: SCHOLAR_ARG,
        sem: S('Semester code, e.g. "Y1S1".'),
        item: S('What was bought.'),
        cat: S(`Category — one of: ${EXPENSE_CATS.join(', ')}`),
        amount: N('Peso amount.'),
        date: S('Date, YYYY-MM-DD.'),
        qty: N('Quantity (default 1).'),
        vendor: S('Vendor or payee.'),
        avb: S('"Actual" or "Budget" (default Actual).'),
        sent: S('"Yes" if the money has already been sent.'),
        bucket: S('Override the bucket derived from the category.'),
      },
      ['sem', 'item', 'cat', 'amount', 'date']
    ),
    summarize: (a) => `Add expense · ${a.item} · ${peso(a.amount)} · ${a.cat} · ${a.date} · ${a.scholar || 'scholar'} ${a.sem}`,
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      const sem = requireSem(a.sem);
      const cat = requireCat(a.cat);
      const id = `${scholar}_${sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const bucket = a.bucket || CAT_TO_BUCKET[cat] || 'college';
      const [row] = await sql`
        insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
        values (${id}, ${scholar}, ${sem}, ${a.item}, ${cat}, ${bucket}, ${a.amount}, ${a.qty ?? 1},
                ${a.date}, ${a.avb || 'Actual'}, ${a.sent || ''}, ${a.vendor || ''}, ${null})
        returning *
      `;
      return row;
    },
  },
  {
    name: 'update_expense',
    roles: ['mentor'],
    description: 'Change fields on one saved expense row, found by id via list_expenses. Only the fields you pass are changed.',
    parameters: obj(
      {
        id: S('Expense id.'),
        item: S('New description.'),
        cat: S('New category.'),
        amount: N('New peso amount.'),
        date: S('New date, YYYY-MM-DD.'),
        qty: N('New quantity.'),
        vendor: S('New vendor.'),
        sem: S('New semester.'),
        bucket: S('New bucket.'),
        avb: S('"Actual" or "Budget".'),
        sent: S('"Yes" or "".'),
      },
      ['id']
    ),
    summarize: (a) => {
      const { id, ...rest } = a;
      const changes = Object.entries(rest)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k} → ${k === 'amount' ? peso(v) : v}`);
      return `Edit expense ${id} · ${changes.join(', ') || 'no changes'}`;
    },
    run: async (a) => {
      const { id, ...rest } = a;
      const fields = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined || v === null) continue;
        fields[k] = k === 'cat' ? requireCat(v) : k === 'sem' ? requireSem(v) : v;
      }
      // Keep the bucket consistent with a changed category unless the caller
      // set one explicitly — otherwise a re-categorised travel expense keeps
      // reporting under `college` in the public profile bucket totals.
      if (fields.cat && !fields.bucket) fields.bucket = CAT_TO_BUCKET[fields.cat] || 'college';
      const keys = Object.keys(fields);
      if (!keys.length) throw new ToolError('No fields to update.');
      const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const [row] = await sql.query(
        `update expenses set ${setClause} where id = $1 returning *`,
        [id, ...keys.map((k) => fields[k])]
      );
      if (!row) throw new ToolError(`No expense with id ${id}.`);
      return row;
    },
  },
  {
    name: 'delete_expense',
    roles: ['mentor'],
    description: 'Permanently delete one saved expense row by id.',
    parameters: obj({ id: S('Expense id.') }, ['id']),
    summarize: (a) => `Delete expense ${a.id} — permanent`,
    run: async (a) => {
      const [row] = await sql`select id, item, amount from expenses where id = ${a.id}`;
      if (!row) throw new ToolError(`No expense with id ${a.id}.`);
      await sql`delete from expenses where id = ${a.id}`;
      return { ok: true, deleted: row };
    },
  },
  {
    name: 'mark_expense_sent',
    roles: ['mentor'],
    description: 'Mark one expense as sent (the money has been transferred).',
    parameters: obj({ id: S('Expense id.') }, ['id']),
    summarize: (a) => `Mark expense ${a.id} as sent`,
    run: async (a) => {
      const [row] = await sql`update expenses set sent = 'Yes' where id = ${a.id} returning *`;
      if (!row) throw new ToolError(`No expense with id ${a.id}.`);
      return row;
    },
  },

  // Submissions ──────────────────────────────────────────────────────────────
  {
    name: 'submit_expense',
    roles: ['mentor', 'scholar'],
    description:
      'Submit an expense for mentor review (the scholar-facing path). Creates a pending submission rather than a saved expense.',
    parameters: obj(
      {
        scholar: SCHOLAR_ARG,
        sem: S('Semester code.'),
        item: S('What was bought.'),
        cat: S(`Category — one of: ${EXPENSE_CATS.join(', ')}`),
        amount: N('Peso amount.'),
        date: S('Date, YYYY-MM-DD.'),
        qty: N('Quantity (default 1).'),
        vendor: S('Vendor or payee.'),
        resubmit_of: S('Id of a rejected submission this one replaces.'),
      },
      ['sem', 'item', 'cat', 'amount', 'date']
    ),
    summarize: (a) =>
      `Submit for review · ${a.item} · ${peso(a.amount)} · ${a.cat} · ${a.date}${a.resubmit_of ? ` (replaces ${a.resubmit_of})` : ''}`,
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      const sem = requireSem(a.sem);
      const cat = requireCat(a.cat);
      const expenseData = {
        sem, item: a.item, cat, amount: a.amount, qty: a.qty ?? 1,
        date: a.date, vendor: a.vendor || '', avb: 'Actual', sent: '',
        bucket: CAT_TO_BUCKET[cat] || 'college',
      };
      if (a.resubmit_of) {
        // Scope the supersede to the caller's own rows, same as the route —
        // id alone would let one scholar pull another's row out of the queue.
        if (ctx.role === 'mentor') {
          await sql`update expense_submissions set status = 'resubmitted' where id = ${a.resubmit_of}`;
        } else {
          await sql`update expense_submissions set status = 'resubmitted' where id = ${a.resubmit_of} and scholar_key = ${scholar}`;
        }
      }
      const [row] = await sql`
        insert into expense_submissions (scholar_key, expense_data, status)
        values (${scholar}, ${expenseData}, 'pending')
        returning *
      `;
      return row;
    },
  },
  {
    name: 'update_submission',
    roles: ['mentor', 'scholar'],
    description: 'Edit the contents of a still-pending submission. Only the fields you pass change; approved or rejected rows are frozen.',
    parameters: obj(
      {
        id: S('Submission id.'),
        item: S('New description.'),
        cat: S('New category.'),
        amount: N('New peso amount.'),
        date: S('New date, YYYY-MM-DD.'),
        qty: N('New quantity.'),
        vendor: S('New vendor.'),
        sem: S('New semester.'),
      },
      ['id']
    ),
    summarize: (a) => {
      const { id, ...rest } = a;
      const changes = Object.entries(rest)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k} → ${k === 'amount' ? peso(v) : v}`);
      return `Edit pending submission ${id} · ${changes.join(', ') || 'no changes'}`;
    },
    run: async (a, ctx) => {
      const rows = ctx.role === 'mentor'
        ? await sql`select * from expense_submissions where id = ${a.id} and status = 'pending'`
        : await sql`select * from expense_submissions where id = ${a.id} and status = 'pending' and scholar_key = ${ctx.scholarKey}`;
      const [sub] = rows;
      if (!sub) throw new ToolError('No pending submission with that id (it may already be reviewed).');

      const { id, ...rest } = a;
      const next = { ...sub.expense_data };
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined || v === null) continue;
        next[k] = k === 'cat' ? requireCat(v) : k === 'sem' ? requireSem(v) : v;
      }
      if (rest.cat) next.bucket = CAT_TO_BUCKET[next.cat] || 'college';

      const updated = ctx.role === 'mentor'
        ? await sql`update expense_submissions set expense_data = ${next} where id = ${id} and status = 'pending' returning *`
        : await sql`update expense_submissions set expense_data = ${next} where id = ${id} and status = 'pending' and scholar_key = ${ctx.scholarKey} returning *`;
      return updated[0];
    },
  },
  {
    name: 'approve_submission',
    roles: ['mentor'],
    description: 'Approve a pending submission — inserts the expense and marks the submission approved, atomically.',
    parameters: obj({ id: S('Submission id.') }, ['id']),
    summarize: (a) => `Approve submission ${a.id} → saves it as a real expense`,
    run: async (a) => {
      const [sub] = await sql`select * from expense_submissions where id = ${a.id}`;
      if (!sub) throw new ToolError(`No submission with id ${a.id}.`);
      if (sub.status !== 'pending') throw new ToolError(`Submission ${a.id} is already ${sub.status}.`);
      const scholar = sub.scholar_key;
      const exp = sub.expense_data;
      const id = exp.id || `${scholar}_${exp.sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const bucket = exp.bucket || CAT_TO_BUCKET[exp.cat] || 'college';
      const client = sql;
      const [[expenseRow], [submissionRow]] = await client.transaction([
        client`
          insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
          values (${id}, ${scholar}, ${exp.sem}, ${exp.item}, ${exp.cat}, ${bucket}, ${exp.amount}, ${exp.qty},
                  ${exp.date}, ${exp.avb}, ${exp.sent}, ${exp.vendor || ''}, ${exp.group_id || null})
          returning *
        `,
        client`
          update expense_submissions set status = 'approved', reviewed_at = now()
          where id = ${a.id}
          returning *
        `,
      ]);
      return { expense: expenseRow, submission: submissionRow };
    },
  },
  {
    name: 'reject_submission',
    roles: ['mentor'],
    description: 'Reject a pending submission with a comment explaining why.',
    parameters: obj({ id: S('Submission id.'), comment: S('Reason shown to the scholar.') }, ['id']),
    summarize: (a) => `Reject submission ${a.id}${a.comment ? ` — "${a.comment}"` : ''}`,
    run: async (a) => {
      const [row] = await sql`
        update expense_submissions
        set status = 'rejected', rejection_comment = ${a.comment || null}, reviewed_at = now()
        where id = ${a.id}
        returning *
      `;
      if (!row) throw new ToolError(`No submission with id ${a.id}.`);
      return row;
    },
  },

  // Grades ───────────────────────────────────────────────────────────────────
  {
    name: 'add_grades',
    roles: ['mentor', 'scholar'],
    description:
      'Add one or more grade entries for a semester. Pass entries as a JSON array of objects: [{"subject":"Anatomy","units":3,"prelim":1.75,"midterm":1.5,"final_grade":1.5}].',
    parameters: obj(
      {
        scholar: SCHOLAR_ARG,
        sem: S('Semester code, e.g. "Y1S1".'),
        school: S('"uv" (university 1.0–5.0 scale) or "k12" (percentage). Default "uv".'),
        entries: S('JSON array of grade objects — subject, units, prelim, midterm, final_grade.'),
      },
      ['sem', 'entries']
    ),
    summarize: (a) => {
      const list = (() => { try { return parseJson(a.entries, 'entries') || []; } catch { return []; } })();
      const names = list.map((g) => g.subject).filter(Boolean).join(', ');
      return `Add ${list.length} grade ${list.length === 1 ? 'entry' : 'entries'} · ${a.sem}${names ? ` · ${names}` : ''}`;
    },
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      const sem = requireSem(a.sem);
      const school = a.school || 'uv';
      const list = parseJson(a.entries, 'entries');
      if (!Array.isArray(list) || !list.length) throw new ToolError('entries must be a non-empty JSON array.');

      const rows = [];
      for (const g of list) {
        if (!g.subject) throw new ToolError('Every entry needs a subject.');
        // period_avg / pct_equiv are computed at the call site everywhere else
        // (GradeEntry.jsx, the Tier 3 grade ingest) — mirror that here so an
        // AI-added row carries the same derived columns as a hand-typed one.
        const marks = [g.prelim, g.midterm, g.final_grade].filter((v) => v != null).map(Number);
        const periodAvg = g.period_avg ?? (marks.length ? marks.reduce((s, v) => s + v, 0) / marks.length : null);
        const pctEquiv = g.pct_equiv ?? (periodAvg == null ? null : school === 'k12' ? periodAvg : Math.max(0, 100 - (periodAvg - 1) * 12.5));
        const [row] = await sql`
          insert into grade_entries (scholar, sem, school, subject, units, prelim, midterm, final_grade, period_avg, pct_equiv)
          values (${scholar}, ${sem}, ${school}, ${g.subject}, ${g.units ?? 3}, ${g.prelim ?? null},
                  ${g.midterm ?? null}, ${g.final_grade ?? null}, ${periodAvg}, ${pctEquiv})
          returning *
        `;
        rows.push(row);
      }
      return coerceGrades(rows);
    },
  },
  {
    name: 'update_grade',
    roles: ['mentor', 'scholar'],
    description: 'Change fields on one grade entry, found by id via list_grades.',
    parameters: obj(
      {
        id: S('Grade entry id.'),
        subject: S('New subject name.'),
        units: N('New unit count.'),
        prelim: N('New prelim mark.'),
        midterm: N('New midterm mark.'),
        final_grade: N('New final mark.'),
      },
      ['id']
    ),
    summarize: (a) => {
      const { id, ...rest } = a;
      const changes = Object.entries(rest).filter(([, v]) => v != null).map(([k, v]) => `${k} → ${v}`);
      return `Edit grade ${id} · ${changes.join(', ') || 'no changes'}`;
    },
    run: async (a, ctx) => {
      const { id, ...rest } = a;
      const fields = Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null));
      const keys = Object.keys(fields);
      if (!keys.length) throw new ToolError('No fields to update.');
      const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map((k) => fields[k]);
      // Scholars are pinned to their own rows — id alone would let one scholar
      // edit another's grades (same shape as app/api/grades/[id]/route.js).
      const scope = ctx.role === 'mentor' ? '' : ` and scholar = $${keys.length + 2}`;
      const [row] = await sql.query(
        `update grade_entries set ${setClause} where id = $1${scope} returning *`,
        ctx.role === 'mentor' ? [id, ...values] : [id, ...values, ctx.scholarKey]
      );
      if (!row) throw new ToolError(`No grade entry with id ${id}.`);
      return coerceGrades([row])[0];
    },
  },
  {
    name: 'delete_grade',
    roles: ['mentor', 'scholar'],
    description: 'Delete one grade entry by id.',
    parameters: obj({ id: S('Grade entry id.') }, ['id']),
    summarize: (a) => `Delete grade entry ${a.id} — permanent`,
    run: async (a, ctx) => {
      if (ctx.role === 'mentor') await sql`delete from grade_entries where id = ${a.id}`;
      else await sql`delete from grade_entries where id = ${a.id} and scholar = ${ctx.scholarKey}`;
      return { ok: true };
    },
  },
  {
    name: 'delete_semester_grades',
    roles: ['mentor', 'scholar'],
    description: 'Delete every grade entry for one scholar in one semester. Use sparingly — this wipes the whole semester.',
    parameters: obj({ scholar: SCHOLAR_ARG, sem: S('Semester code.') }, ['sem']),
    summarize: (a) => `Delete ALL grades for ${a.scholar || 'this scholar'} in ${a.sem} — permanent`,
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      const sem = requireSem(a.sem);
      await sql`delete from grade_entries where scholar = ${scholar} and sem = ${sem}`;
      return { ok: true, scholar, sem };
    },
  },

  // English ──────────────────────────────────────────────────────────────────
  {
    name: 'log_english_session',
    roles: ['mentor', 'scholar'],
    description: 'Log an English study session (date, minutes, activity type).',
    parameters: obj(
      {
        scholar: SCHOLAR_ARG,
        date: S('Date, YYYY-MM-DD.'),
        duration_minutes: N('Length in minutes.'),
        activity_type: S('e.g. Speaking, Listening, Reading, Writing, Free Conversation.'),
        notes: S('Optional notes.'),
        sem: S('Semester code.'),
        period_id: S('English period id this session belongs to.'),
        category: S('Practice category (default "conversation").'),
      },
      ['date', 'duration_minutes', 'activity_type']
    ),
    summarize: (a) =>
      `Log English session · ${a.date} · ${a.duration_minutes} min · ${a.activity_type}${a.scholar ? ` · ${a.scholar}` : ''}`,
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      const [row] = await sql`
        insert into english_sessions (scholar, sem, date, duration_minutes, activity_type, notes, category, period_id)
        values (${scholar}, ${a.sem ?? null}, ${a.date}, ${a.duration_minutes}, ${a.activity_type},
                ${a.notes ?? null}, ${a.category || 'conversation'}, ${a.period_id ?? null})
        returning *
      `;
      return row;
    },
  },
  {
    name: 'update_english_session',
    roles: ['mentor', 'scholar'],
    description: 'Change a logged English session, found by id via list_english_sessions.',
    parameters: obj(
      {
        id: S('Session id.'),
        date: S('New date, YYYY-MM-DD.'),
        duration_minutes: N('New length in minutes.'),
        activity_type: S('New activity type.'),
        notes: S('New notes.'),
      },
      ['id']
    ),
    summarize: (a) => {
      const { id, ...rest } = a;
      const changes = Object.entries(rest).filter(([, v]) => v != null).map(([k, v]) => `${k} → ${v}`);
      return `Edit English session ${id} · ${changes.join(', ') || 'no changes'}`;
    },
    run: async (a, ctx) => {
      // The route updates all four columns at once; read-modify-write here so
      // omitted fields keep their stored value instead of being nulled out.
      const existing = ctx.role === 'mentor'
        ? await sql`select * from english_sessions where id = ${a.id}`
        : await sql`select * from english_sessions where id = ${a.id} and scholar = ${ctx.scholarKey}`;
      const [cur] = existing;
      if (!cur) throw new ToolError(`No English session with id ${a.id}.`);
      const date = a.date ?? cur.date;
      const mins = a.duration_minutes ?? cur.duration_minutes;
      const act = a.activity_type ?? cur.activity_type;
      const notes = a.notes ?? cur.notes;
      const [row] = await sql`
        update english_sessions
        set date = ${date}, duration_minutes = ${mins}, activity_type = ${act}, notes = ${notes}
        where id = ${a.id}
        returning *
      `;
      return row;
    },
  },
  {
    name: 'delete_english_session',
    roles: ['mentor', 'scholar'],
    description: 'Delete one logged English session by id.',
    parameters: obj({ id: S('Session id.') }, ['id']),
    summarize: (a) => `Delete English session ${a.id} — permanent`,
    run: async (a, ctx) => {
      if (ctx.role === 'mentor') await sql`delete from english_sessions where id = ${a.id}`;
      else await sql`delete from english_sessions where id = ${a.id} and scholar = ${ctx.scholarKey}`;
      return { ok: true };
    },
  },
  {
    name: 'create_english_period',
    roles: ['mentor'],
    description: 'Create a new English study period (a date range with an hour goal).',
    parameters: obj(
      {
        scholar: SCHOLAR_ARG,
        label: S('Period name, e.g. "Summer Bootcamp 2026".'),
        session_type: S('summer_bootcamp | oet_prep'),
        start_date: S('Start date, YYYY-MM-DD.'),
        end_date: S('End date, YYYY-MM-DD.'),
        hour_goal: N('Total hours targeted for the period.'),
      },
      ['label', 'session_type', 'start_date', 'end_date', 'hour_goal']
    ),
    summarize: (a) => `Create English period · "${a.label}" · ${a.start_date} → ${a.end_date} · ${a.hour_goal}h goal`,
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      const [row] = await sql`
        insert into english_periods (scholar, label, session_type, start_date, end_date, hour_goal)
        values (${scholar}, ${a.label}, ${a.session_type}, ${a.start_date}, ${a.end_date}, ${a.hour_goal})
        returning *
      `;
      return row;
    },
  },
  {
    name: 'update_english_period',
    roles: ['mentor'],
    description: 'Change an English period — its dates, hour goal, category goals or weekly targets.',
    parameters: obj(
      {
        id: S('Period id.'),
        label: S('New label.'),
        session_type: S('New session type.'),
        start_date: S('New start date.'),
        end_date: S('New end date.'),
        hour_goal: N('New total hour goal.'),
        weekly_target_hours: N('New weekly hour target.'),
        category_goals: S('JSON object of per-category hour goals.'),
        weekly_target_by_category: S('JSON object of per-category weekly targets.'),
      },
      ['id']
    ),
    summarize: (a) => {
      const { id, ...rest } = a;
      const changes = Object.entries(rest).filter(([, v]) => v != null).map(([k, v]) => `${k} → ${v}`);
      return `Edit English period ${id} · ${changes.join(', ') || 'no changes'}`;
    },
    run: async (a) => {
      const { id, ...rest } = a;
      const fields = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v == null) continue;
        fields[k] = k === 'category_goals' || k === 'weekly_target_by_category' ? parseJson(v, k) : v;
      }
      const keys = Object.keys(fields);
      if (!keys.length) throw new ToolError('No fields to update.');
      const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const [row] = await sql.query(
        `update english_periods set ${setClause} where id = $1 returning *`,
        [id, ...keys.map((k) => fields[k])]
      );
      if (!row) throw new ToolError(`No English period with id ${id}.`);
      return row;
    },
  },
  {
    name: 'delete_english_period',
    roles: ['mentor'],
    description: 'Delete an English study period by id.',
    parameters: obj({ id: S('Period id.') }, ['id']),
    summarize: (a) => `Delete English period ${a.id} — permanent`,
    run: async (a) => {
      await sql`delete from english_periods where id = ${a.id}`;
      return { ok: true };
    },
  },
  {
    name: 'save_english_scenario',
    roles: ['mentor', 'scholar'],
    description: 'Save (or update, if you pass an id) an English "what-if" pacing scenario.',
    parameters: obj(
      {
        id: S('Existing scenario id — omit to create a new one.'),
        scholar: SCHOLAR_ARG,
        period_id: S('English period the scenario is against.'),
        name: S('Scenario name.'),
        description: S('What the scenario assumes.'),
        additional_hrs_per_week: N('Extra hours per week modelled.'),
        projected_total: N('Projected total hours.'),
        projected_completion_date: S('Projected completion date, YYYY-MM-DD.'),
        gap_vs_goal: N('Hours short of (negative) or over the goal.'),
      },
      ['period_id', 'name', 'additional_hrs_per_week']
    ),
    summarize: (a) =>
      `${a.id ? 'Update' : 'Save'} English scenario · "${a.name}" · +${a.additional_hrs_per_week} hrs/week`,
    run: async (a, ctx) => {
      const scholar = scopeScholar(ctx, a.scholar);
      if (a.id) {
        // Scholars are pinned to their own scenarios; the neon tagged template
        // can't splice a conditional fragment, so the scope is a separate query.
        const rows = ctx.role === 'mentor'
          ? await sql`
              update english_scenarios set
                period_id = ${a.period_id}, name = ${a.name}, description = ${a.description ?? null},
                additional_hrs_per_week = ${a.additional_hrs_per_week}, projected_total = ${a.projected_total ?? null},
                projected_completion_date = ${a.projected_completion_date ?? null}, gap_vs_goal = ${a.gap_vs_goal ?? null},
                updated_at = now()
              where id = ${a.id}
              returning *
            `
          : await sql`
              update english_scenarios set
                period_id = ${a.period_id}, name = ${a.name}, description = ${a.description ?? null},
                additional_hrs_per_week = ${a.additional_hrs_per_week}, projected_total = ${a.projected_total ?? null},
                projected_completion_date = ${a.projected_completion_date ?? null}, gap_vs_goal = ${a.gap_vs_goal ?? null},
                updated_at = now()
              where id = ${a.id} and scholar = ${ctx.scholarKey}
              returning *
            `;
        const [row] = rows;
        if (!row) throw new ToolError(`No scenario with id ${a.id}.`);
        return row;
      }
      const [row] = await sql`
        insert into english_scenarios
          (scholar, period_id, name, description, additional_hrs_per_week, projected_total, projected_completion_date, gap_vs_goal)
        values (${scholar}, ${a.period_id}, ${a.name}, ${a.description ?? null}, ${a.additional_hrs_per_week},
                ${a.projected_total ?? null}, ${a.projected_completion_date ?? null}, ${a.gap_vs_goal ?? null})
        returning *
      `;
      return row;
    },
  },
  {
    name: 'delete_english_scenario',
    roles: ['mentor', 'scholar'],
    description: 'Delete a saved English pacing scenario by id.',
    parameters: obj({ id: S('Scenario id.') }, ['id']),
    summarize: (a) => `Delete English scenario ${a.id} — permanent`,
    run: async (a, ctx) => {
      if (ctx.role === 'mentor') await sql`delete from english_scenarios where id = ${a.id}`;
      else await sql`delete from english_scenarios where id = ${a.id} and scholar = ${ctx.scholarKey}`;
      return { ok: true };
    },
  },

  // Program state ────────────────────────────────────────────────────────────
  {
    name: 'toggle_action',
    roles: ['mentor'],
    description: 'Mark a mentor action item done or not done, found by id via list_actions.',
    parameters: obj({ id: S('Action id.'), done: B('true = completed.') }, ['id', 'done']),
    summarize: (a) => `Mark action ${a.id} as ${a.done ? 'done' : 'not done'}`,
    run: async (a) => {
      const [row] = await sql`update actions set done = ${a.done} where id = ${a.id} returning *`;
      if (!row) throw new ToolError(`No action with id ${a.id}.`);
      return row;
    },
  },
  {
    name: 'dismiss_alert',
    roles: ['mentor'],
    description: 'Dismiss (delete) an alert by id.',
    parameters: obj({ id: S('Alert id.') }, ['id']),
    summarize: (a) => `Dismiss alert ${a.id}`,
    run: async (a) => {
      await sql`delete from alerts where id = ${a.id}`;
      return { ok: true };
    },
  },
  {
    name: 'set_scholar_semester',
    roles: ['mentor'],
    description: "Advance or change a scholar's current semester.",
    parameters: obj({ scholar: SCHOLAR_ARG, sem: S('New semester code, e.g. "Y1S2".') }, ['scholar', 'sem']),
    summarize: (a) => `Set ${a.scholar}'s current semester to ${a.sem}`,
    run: async (a) => {
      const sem = requireSem(a.sem);
      const [row] = await sql`update scholars set current_sem = ${sem} where scholar_key = ${a.scholar} returning *`;
      if (!row) throw new ToolError(`No scholar with key ${a.scholar}.`);
      return row;
    },
  },
  {
    name: 'upsert_career_step',
    roles: ['mentor'],
    description: 'Set the status, exam date, score or notes on one licensure pathway step (PNLE, OET, NCLEX, OSCE, AHPRA).',
    parameters: obj(
      {
        scholar: SCHOLAR_ARG,
        step: S('Step name as stored on the career tracker.'),
        status: S('e.g. pending | in_progress | passed | failed'),
        exam_date: S('Exam date, YYYY-MM-DD.'),
        score: S('Score achieved.'),
        notes: S('Notes.'),
      },
      ['scholar', 'step', 'status']
    ),
    summarize: (a) =>
      `Set ${a.scholar}'s "${a.step}" step to ${a.status}${a.exam_date ? ` · ${a.exam_date}` : ''}${a.score ? ` · score ${a.score}` : ''}`,
    run: async (a) => {
      const [row] = await sql`
        insert into career_steps (scholar, step, status, exam_date, score, notes)
        values (${a.scholar}, ${a.step}, ${a.status}, ${a.exam_date ?? null}, ${a.score ?? null}, ${a.notes ?? null})
        on conflict (scholar, step) do update set
          status = excluded.status, exam_date = excluded.exam_date,
          score = excluded.score, notes = excluded.notes, updated_at = now()
        returning *
      `;
      return row;
    },
  },
  {
    name: 'set_config',
    roles: ['mentor'],
    description: 'Set a program-config value, e.g. the program-details copy the public AI chat reads.',
    parameters: obj({ key: S('Config key.'), value: S('New value.') }, ['key', 'value']),
    summarize: (a) => `Set config "${a.key}" (${String(a.value).length} chars)`,
    run: async (a) => {
      const [row] = await sql`
        insert into config (key, value) values (${a.key}, ${a.value})
        on conflict (key) do update set value = excluded.value
        returning key, value
      `;
      return row;
    },
  },
];

// ── registry ─────────────────────────────────────────────────────────────────

export const TOOLS = [
  ...READ_TOOLS.map((t) => ({ ...t, mutates: false })),
  ...WRITE_TOOLS.map((t) => ({ ...t, mutates: true })),
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name) {
  return BY_NAME.get(name) || null;
}

export function toolsForRole(role) {
  return TOOLS.filter((t) => t.roles.includes(role));
}

// Gemini function declarations for the tools this role may call. Gemini rejects
// an empty `properties` object, so parameterless tools declare no schema.
export function functionDeclarations(role) {
  return toolsForRole(role).map((t) => {
    const hasProps = Object.keys(t.parameters.properties || {}).length > 0;
    return {
      name: t.name,
      description: t.description,
      ...(hasProps ? { parameters: t.parameters } : {}),
    };
  });
}

// Single entry point for running a tool. Re-checks the role every time — the
// confirm-and-execute round trip arrives as a fresh request, so authorisation
// is verified against that request's own token, never carried over from the
// turn that proposed the call.
export async function runTool(name, args, ctx) {
  const tool = getTool(name);
  if (!tool) throw new ToolError(`Unknown tool: ${name}`);
  if (!tool.roles.includes(ctx.role)) throw new ToolError(`Not authorized to run ${name}.`);
  return tool.run(args || {}, ctx);
}

export function describeCall(name, args) {
  const tool = getTool(name);
  if (!tool) return name;
  return tool.summarize ? tool.summarize(args || {}) : `${name}(${JSON.stringify(args || {})})`;
}

export { ToolError };
