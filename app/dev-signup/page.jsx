'use client';

// TEMPORARY — one-time-use page to create the Better Auth login for the
// sandbox `demo` scholar (see CLAUDE.md's "demo scholar" note / PR #246).
// No UI in this app self-serves account creation (LockScreen/ScholarAuthGate
// only sign in), and the sandbox this was built in can't reach the Neon Auth
// domain to create the account directly — so this page exists purely so a
// human can create it once, in a real browser, then it gets deleted.
//
// Not linked from any nav. Creating an account here does NOT grant access to
// anything: every API route 403s until a user_profile row links this
// account's user id to a role/scholar_key, which happens separately (see the
// PR). Safe to leave up briefly; delete once the demo account exists.

import { useState } from 'react';
import { signUp } from '../../src/lib/auth-client.js';

export default function DevSignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Demo Scholar');
  const [status, setStatus] = useState(null); // null | 'loading' | 'done' | { error }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    const { error } = await signUp.email({ email, password, name });
    if (error) {
      setStatus({ error: error.message || 'Sign-up failed' });
      return;
    }
    setStatus('done');
  }

  return (
    <div
      style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif', padding: '0 16px' }}
    >
      <h1 style={{ fontSize: 18 }}>Create demo scholar login</h1>
      <p style={{ fontSize: 13, color: '#555' }}>
        Temporary page. Creates a Better Auth account only — it has no access to anything until it's
        linked to the <code>demo</code> scholar server-side.
      </p>
      {status === 'done' ? (
        <p style={{ color: 'green' }}>
          Account created. Tell your assistant the email you used so it can finish linking this
          account to the demo scholar — then sign in at <a href="/home/demo">/home/demo</a>.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
          <input
            type="text"
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 8 }}
          />
          <button type="submit" disabled={status === 'loading'} style={{ padding: 8 }}>
            {status === 'loading' ? 'Creating…' : 'Create account'}
          </button>
          {status?.error && <p style={{ color: 'crimson', fontSize: 13 }}>{status.error}</p>}
        </form>
      )}
    </div>
  );
}
