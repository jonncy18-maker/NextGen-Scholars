import { AuthError } from './auth.js';

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      // Every route here returns data scoped to whoever's bearer token (or
      // lack of one) made the request. Without an explicit directive, Next
      // App Router route handlers default to a *shareable* Cache-Control
      // (`public, max-age=0, must-revalidate`) with no `Vary: Authorization`
      // — meaning Vercel's edge is free to serve one caller's cached/
      // coalesced response to a completely different caller hitting the
      // same URL moments later. That's what let a scholar's dashboard show
      // a different scholar's data right after switching accounts. Marking
      // every response here private/no-store closes that off at the root.
      'cache-control': 'private, no-store',
      ...(init.headers || {}),
    },
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
