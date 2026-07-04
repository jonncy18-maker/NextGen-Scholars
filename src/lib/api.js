import { getToken } from './auth-client.js';

// Same-origin in prod/preview; VITE_API_BASE-style override only needed if
// ever running the frontend against a separately-deployed API.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let pokeListeners = [];

// Called by write helpers after a successful mutation so the polling hook
// (src/hooks/useChanges.js, added in a later step) can refetch immediately
// instead of waiting for its next interval tick.
export function onAfterWrite(listener) {
  pokeListeners.push(listener);
  return () => { pokeListeners = pokeListeners.filter(l => l !== listener); };
}

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, retry = true } = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    // Every route here is scoped by the caller's token (mentor vs. a
    // specific scholar) — never let the browser serve back a cached
    // response from a different signed-in user for the same URL.
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    // Token may have expired between page load and this call — one retry
    // with a freshly-fetched token before surfacing the failure.
    return request(path, { method, body, retry: false });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get:   (path)       => request(path),
  post:  (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put:   (path, body) => request(path, { method: 'PUT', body }),
  del:   (path)        => request(path, { method: 'DELETE' }),
  afterWrite: () => pokeListeners.forEach(l => l()),
};

export { ApiError };
