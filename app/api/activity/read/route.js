import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Mirrors markActivityRead(ids) — mentor reads the activity feed.
export const PATCH = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { ids } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return json({ error: 'ids required' }, { status: 400 });
  await sql`update activity_log set read = true where id = any(${ids})`;
  return json({ ok: true });
});
