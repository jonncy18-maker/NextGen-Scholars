import { sql } from '../../../lib/db.js';
import { requireMentor } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors ProgramDetailsSection.jsx's supabase.from('config') read/upsert.
// GET ?key= returns { key, value } for one row (mentor-only — the public
// program-details copy the "Ask AI" widget uses is read directly from this
// same table by app/api/ask-public/route.js, unauthenticated by design).
export const GET = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) return json({ error: 'key required' }, { status: 400 });
  const [row] = await sql`select key, value from config where key = ${key}`;
  return json(row ?? null);
});

export const PUT = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { key, value } = await request.json();
  if (!key) return json({ error: 'key required' }, { status: 400 });
  const [row] = await sql`
    insert into config (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value
    returning key, value
  `;
  return json(row);
});
