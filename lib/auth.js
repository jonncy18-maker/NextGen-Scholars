import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sql } from './db.js';

// Neon Auth (Better Auth) JWKS — public by design, safe to hardcode. Module-
// level cache so we don't refetch the key set on every request.
const JWKS_URL = 'https://ep-ancient-waterfall-ajoqek7o.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json';
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function getUser(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AuthError(401, 'Missing bearer token');

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks));
  } catch {
    throw new AuthError(401, 'Invalid or expired token');
  }

  const userId = payload.sub;
  if (!userId) throw new AuthError(401, 'Token missing subject');

  // Never trust role/scholar_key from the token itself — resolve from our
  // own table so a compromised or stale client can't self-elevate.
  const [profile] = await sql`
    select role, scholar_key from user_profile where user_id = ${userId}
  `;
  if (!profile) throw new AuthError(403, 'No profile for this user');

  return { userId, role: profile.role, scholarKey: profile.scholar_key };
}

export async function requireMentor(request) {
  const user = await getUser(request);
  if (user.role !== 'mentor') throw new AuthError(403, 'Mentor access required');
  return user;
}

// Returns { role, scholarKey }. Mentor gets scholarKey=null (unscoped —
// callers should skip the WHERE-scholar filter for mentor role). Scholar
// gets their own key and callers must scope all queries to it.
export async function requireScholarOwn(request) {
  const user = await getUser(request);
  if (user.role !== 'mentor' && user.role !== 'scholar') {
    throw new AuthError(403, 'Not authorized');
  }
  return user;
}

export { AuthError };
