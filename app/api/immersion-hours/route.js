import { immersionSql } from '../../../lib/immersion-db.js';
import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Every response here is scoped per-caller — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// NextGen Immersion is a separate app with its own Neon project and its own
// Neon Auth account system — there's no shared scholar identifier between
// the two apps. This maps our scholar keys to Immersion's users.id (a
// Neon-Auth-issued uuid), looked up once by hand via the Neon console
// (see CLAUDE.md "Immersion hours integration"). Janndilyne isn't listed —
// she's TESDA-track and has no Immersion account; EnglishSection.jsx
// already excludes TESDA scholars from the English section entirely.
const IMMERSION_USER_ID = {
  claire: '26c4ee76-3a24-4193-a323-8a7d2d1fdbc2',
  april: '50848dbd-e387-49eb-836c-893474065f66',
};

// scholar_pace.status is ON_TRACK / AT_RISK / PENDING (Immersion's own
// vocabulary) — map to the good/warning/risk tokens EnglishSection.jsx's
// StatusBadge already renders.
function mapStatus(status) {
  if (status === 'ON_TRACK') return 'good';
  if (status === 'AT_RISK') return 'risk';
  return 'warning'; // PENDING, or any future/unknown status
}

// GET — mentor gets every scholar with an Immersion account; a scholar gets
// only their own (if they have one). Returns { [scholarKey]: { currentHours,
// targetHours, hoursThisWeek, expectedHours, lastSessionAt, status } }.
// Read-only: the `ngs_scholars_reader` Postgres role backing
// IMMERSION_DATABASE_URL can only SELECT from scholar_pace, user_total_hours,
// and users in that project — nothing else, no writes.
export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);

  const keys = role === 'mentor' ? Object.keys(IMMERSION_USER_ID) : [scholarKey];
  const ids = keys.map((sk) => IMMERSION_USER_ID[sk]).filter(Boolean);
  if (!ids.length) return json({});

  const rows = await immersionSql`select * from scholar_pace where user_id = any(${ids})`;

  const byUserId = Object.fromEntries(rows.map((r) => [r.user_id, r]));
  const result = {};
  for (const sk of keys) {
    const userId = IMMERSION_USER_ID[sk];
    if (!userId) continue;
    const r = byUserId[userId];
    if (!r) continue;
    // Neon returns NUMERIC columns as strings — coerce before handing back
    // (same gotcha documented in CLAUDE.md for gpa/amount_php/grade_entries).
    result[sk] = {
      currentHours: Number(r.current_hours),
      targetHours: r.target_hours != null ? Number(r.target_hours) : null,
      hoursThisWeek: Number(r.hours_this_week),
      expectedHours: r.expected_hours != null ? Number(r.expected_hours) : null,
      lastSessionAt: r.last_session_at,
      status: mapStatus(r.status),
    };
  }
  return json(result);
});
