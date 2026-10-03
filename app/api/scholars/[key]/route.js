import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';
import { parseTrackInput } from '../../../../src/lib/pathway.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mentor-only. Body is `{ sem }` (mirrors writeSemester(scholar, sem)) and/or
// `{ track }` — the program track, allowlisted to NGN / NGH / none. 'none' (or
// null / '') is stored as NULL = "not on a track", which hides the Home
// pathway strip. `scholars.track` is free text, so validation lives here.
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { key } = await params;
  await requireMentor(request);
  const body = await request.json();
  const hasSem = 'sem' in body;
  const hasTrack = 'track' in body;
  if (!hasSem && !hasTrack) return json({ error: 'Nothing to update.' }, { status: 400 });

  let row;
  if (hasTrack) {
    let track;
    try {
      track = parseTrackInput(body.track);
    } catch (err) {
      return json({ error: err.message }, { status: 400 });
    }
    [row] = await sql`
      update scholars set track = ${track} where scholar_key = ${key} returning *
    `;
    if (!row) return json({ error: 'Not found' }, { status: 404 });
  }
  if (hasSem) {
    [row] = await sql`
      update scholars set current_sem = ${body.sem} where scholar_key = ${key} returning *
    `;
    if (!row) return json({ error: 'Not found' }, { status: 404 });
  }
  return json(row);
});
