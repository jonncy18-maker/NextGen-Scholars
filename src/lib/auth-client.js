import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';

// Neon Auth (Better Auth) base URL — public endpoint, safe to inline.
const AUTH_BASE_URL = 'https://ep-ancient-waterfall-ajoqek7o.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth';

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [jwtClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;

// NOT YET LIVE-VERIFIED: the JWT plugin returns the per-session bearer
// token as a `set-auth-jwt` response header on authenticated Better Auth
// calls (documented plugin convention), not via a dedicated client method
// (jwtClient() only exposes .jwks()). This sandbox can't reach the Neon
// Auth domain to confirm the header name/behavior empirically — verify
// this against a real sign-in on the deployed preview before relying on
// it, and adjust the header name here if it differs.
//
// getToken() is cached + coalesced for a short window rather than doing a
// fresh network round trip on every call. Two reasons this matters beyond
// performance: (1) ScholarHome/EntryApp fire several api.get() calls back
// to back (bootstrap, periods, sessions, ...) — without coalescing, each
// one independently calls authClient.getSession() in parallel, and if the
// auth backend has any brief propagation delay right after a sign-in swap
// between two different scholar accounts, those independent calls can each
// land on a different, possibly-stale replica of the session — showing the
// previous scholar's data until a hard refresh. Reusing one in-flight/cached
// token across a burst of calls means they all see the same (correct)
// session instead of racing. (2) invalidateToken() lets the sign-in flow
// force a truly fresh fetch right after a credentials check, rather than
// risking a pre-sign-in cached value.
let cachedToken = null;
let cachedAt = 0;
let inFlight = null;
const TOKEN_TTL_MS = 10_000;

export function invalidateToken() {
  cachedToken = null;
  cachedAt = 0;
  inFlight = null;
}

export async function getToken() {
  if (cachedToken !== null && Date.now() - cachedAt < TOKEN_TTL_MS) return cachedToken;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let token = null;
    await authClient.getSession({
      fetchOptions: {
        // Without this, the browser HTTP cache can serve back a previous
        // sign-in's cached /get-session response (same URL, no Vary on the
        // session cookie) — surfacing the last-logged-in scholar's data on
        // first load after switching accounts, until a hard refresh bypasses
        // the cache.
        cache: 'no-store',
        onResponse: (ctx) => {
          token = ctx.response.headers.get('set-auth-jwt');
        },
      },
    });
    cachedToken = token;
    cachedAt = Date.now();
    return token;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
