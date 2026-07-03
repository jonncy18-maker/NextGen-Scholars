import { AuthError } from './auth.js';

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

// Wraps a route handler so AuthError (401/403) and unexpected errors both
// produce a clean JSON response instead of a raw 500 with a stack trace.
export function withErrorHandling(handler) {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      if (err instanceof AuthError) {
        return json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return json({ error: 'Internal error' }, { status: 500 });
    }
  };
}
