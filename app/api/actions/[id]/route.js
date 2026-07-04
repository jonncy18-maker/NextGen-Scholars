import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors writeActionToggle(id, done).
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  const { done } = await request.json();
  const [row] = await sql`update actions set done = ${done} where id = ${params.id} returning *`;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});
