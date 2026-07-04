import { neon } from '@neondatabase/serverless';

// HTTP-mode client — no connection/socket lifecycle to manage, which is the
// right fit for Vercel serverless functions. `sql` is a tagged-template
// query function; `transaction` batches non-interactive statements
// atomically (used for the submission-approve and bulk-grade-insert flows).
//
// Lazily constructed: Next.js evaluates route module graphs during its
// build-time "Collecting page data" step, so an eager `neon(...)` call at
// module scope throws in any environment without DATABASE_URL set at build
// time (this build sandbox included). Reading process.env inside a Proxy
// trap defers that to request time, which is also just correct — env
// shouldn't need to exist at build time for a route that only runs per-request.
let _client = null;
function client() {
  if (!_client) _client = neon(process.env.DATABASE_URL);
  return _client;
}
export const sql = new Proxy(function sql() {}, {
  apply(_target, _thisArg, args) { return client()(...args); },
  get(_target, prop) { return client()[prop]; },
});

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdentifier(name) {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

// Small select helper for the tier1/context query translation — not a full
// query builder, just enough to keep route handlers from hand-assembling
// SQL strings for the common "select ... where col = val" shape.
export async function selectWhere(table, { columns = ['*'], where = {}, orderBy, limit } = {}) {
  assertIdentifier(table);
  const cols = columns.map(c => (c === '*' ? '*' : assertIdentifier(c))).join(', ');
  const conditions = [];
  const values = [];
  Object.entries(where).forEach(([col, val]) => {
    assertIdentifier(col);
    values.push(val);
    conditions.push(`${col} = $${values.length}`);
  });
  let query = `select ${cols} from ${table}`;
  if (conditions.length) query += ` where ${conditions.join(' and ')}`;
  if (orderBy) {
    const [col, dir = 'asc'] = orderBy.split(' ');
    assertIdentifier(col);
    query += ` order by ${col} ${dir === 'desc' ? 'desc' : 'asc'}`;
  }
  if (limit) query += ` limit ${Number(limit)}`;
  return sql.query(query, values);
}
