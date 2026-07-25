import { sql } from './db.js';
import { json } from './http.js';

// Fixed-window rate limiter for the unauthenticated AI routes.
//
// Why the database and not an in-memory Map: these run as Vercel serverless
// functions, so an in-process counter is per-instance. Under exactly the load
// that matters — someone hammering the endpoint — Vercel scales out and each
// new instance starts with an empty map, which is when the limiter is least
// effective. One shared counter in Neon costs a single round trip and actually
// holds across instances.
//
// Fixed window (not sliding) on purpose: it is one upsert with no history to
// keep, and the worst case — 2x the limit across a window boundary — is
// irrelevant when the goal is "stop someone burning the Gemini quota" rather
// than precise fairness.

const CLEANUP_PROBABILITY = 0.02;

// Vercel terminates TLS upstream, so the socket address is a Vercel IP —
// x-forwarded-for's FIRST entry is the real client. Later entries are proxies.
// A caller can forge additional entries but not the one Vercel appends, and
// this is quota protection rather than an auth boundary, so first-entry is the
// right trade-off. Callers behind the same NAT share a bucket; the limits below
// are set high enough that this doesn't matter for real users.
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// Returns { ok, hits, retryAfter }. Fails OPEN: if the counter table is
// unreachable the request is allowed through. A database blip should degrade
// the quota guard, not take the public AI chat down with it.
export async function rateLimit(key, { limit, windowSeconds }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % windowSeconds);
  const retryAfter = windowStart + windowSeconds - nowSec;

  try {
    const [row] = await sql`
      insert into rate_limit (bucket_key, window_start, hits)
      values (${key}, to_timestamp(${windowStart}), 1)
      on conflict (bucket_key, window_start)
        do update set hits = rate_limit.hits + 1
      returning hits
    `;

    // Opportunistic GC so the table can't grow without bound — no cron needed.
    if (Math.random() < CLEANUP_PROBABILITY) {
      sql`delete from rate_limit where window_start < now() - interval '1 day'`
        .catch(() => {});
    }

    const hits = Number(row?.hits ?? 0);
    return { ok: hits <= limit, hits, retryAfter };
  } catch (err) {
    console.error('rate limit check failed, allowing request:', err);
    return { ok: true, hits: 0, retryAfter };
  }
}

// Convenience wrapper: returns a 429 Response when over limit, else null.
export async function enforceRateLimit(request, name, opts) {
  const result = await rateLimit(`${name}:${clientIp(request)}`, opts);
  if (result.ok) return null;
  return json(
    { error: 'Too many requests — please wait a moment and try again.' },
    { status: 429, headers: { 'retry-after': String(result.retryAfter) } }
  );
}

// Reads and parses a JSON body with a hard byte ceiling.
//
// Content-Length alone is not enough (it can be absent on a chunked request, or
// simply wrong), so this measures what actually arrived. Returns
// { error: Response } on oversize/invalid input, otherwise { body }.
export async function readJsonBody(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) {
    return { error: json({ error: 'Request body too large' }, { status: 413 }) };
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return { error: json({ error: 'Could not read request body' }, { status: 400 }) };
  }

  // Byte length, not string length — base64 is ASCII but pasted text may not be.
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { error: json({ error: 'Request body too large' }, { status: 413 }) };
  }

  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { error: json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
}
