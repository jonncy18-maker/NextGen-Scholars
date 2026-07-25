-- Fixed-window counters backing lib/rate-limit.js.
--
-- Used by the two unauthenticated AI routes (/api/ask-public and
-- /api/ask-scholar) so a caller cannot burn the Gemini quota. Kept in Postgres
-- rather than process memory because these run as serverless functions: an
-- in-process counter is per-instance, and Vercel scales out under exactly the
-- load the limiter exists to stop.
--
-- bucket_key is "<route>:<client ip>". window_start is the truncated start of
-- the fixed window, so one row per caller per window; the app upserts and reads
-- back the incremented count in a single statement.
--
-- Rows are garbage-collected opportunistically by the app (a ~2% chance per
-- request deletes anything older than a day), so no cron job is required.

create table if not exists rate_limit (
  bucket_key   text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket_key, window_start)
);

-- Supports the opportunistic cleanup delete.
create index if not exists rate_limit_window_start_idx
  on rate_limit (window_start);
