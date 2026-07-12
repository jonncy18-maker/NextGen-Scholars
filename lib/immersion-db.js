import { neon } from '@neondatabase/serverless';

// Read-only connection to the separate NextGen Immersion app's Neon project
// (a different app, different database, different Neon Auth account system
// — see CLAUDE.md "Immersion hours integration"). Uses a dedicated
// `ngs_scholars_reader` Postgres role, scoped via GRANT SELECT to exactly
// three objects (scholar_pace, user_total_hours, users) — it cannot write,
// and cannot read anything else in that database. Mirrors lib/db.js's lazy
// construction for the same build-time-env reason, and its
// `cache: 'no-store'` for the same Next.js Data Cache reason (see lib/db.js).
let _client = null;
function client() {
  if (!_client) {
    _client = neon(process.env.IMMERSION_DATABASE_URL, {
      fetchOptions: { cache: 'no-store' },
    });
  }
  return _client;
}
export const immersionSql = new Proxy(function immersionSql() {}, {
  apply(_target, _thisArg, args) { return client()(...args); },
  get(_target, prop) { return client()[prop]; },
});
