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
export async function getToken() {
  let token = null;
  await authClient.getSession({
    fetchOptions: {
      onResponse: (ctx) => {
        token = ctx.response.headers.get('set-auth-jwt');
      },
    },
  });
  return token;
}
