'use client';

import { useState } from 'react';
import { authClient, useSession, signIn, signUp, signOut, getToken } from '../lib/auth-client.js';
import { api } from '../lib/api.js';

// Temporary test harness for the Neon Auth (Better Auth) integration — not part of
// the app's real UI. Verifies sign-up, sign-in, JWT extraction (getToken), and an
// authenticated /api/bootstrap call end-to-end. Delete once B4 lands real auth UI.
export function SignInTest() {
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [log, setLog] = useState([]);

  function append(label, value) {
    setLog((l) => [...l, { label, value, at: new Date().toISOString() }]);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    const res = await signUp.email({ email, password, name: name || email });
    append('signUp.email', res);
  }

  async function handleSignIn(e) {
    e.preventDefault();
    const res = await signIn.email({ email, password });
    append('signIn.email', res);
  }

  async function handleSignOut() {
    const res = await signOut();
    append('signOut', res);
  }

  async function handleGetToken() {
    const token = await getToken();
    append('getToken', token ? `${token.slice(0, 24)}... (len ${token.length})` : token);
  }

  async function handleBootstrap() {
    try {
      const data = await api.get('/bootstrap');
      append('GET /api/bootstrap', data);
    } catch (err) {
      append('GET /api/bootstrap (error)', { status: err.status, message: err.message, body: err.body });
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: 18 }}>Neon Auth test harness</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Not linked from the app nav — temporary verification page.</p>

      <section style={{ marginTop: 16 }}>
        <strong>Session:</strong> {isPending ? 'loading…' : session ? session.user?.email : 'signed out'}
      </section>

      <form style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <input placeholder="name (sign-up only)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleSignUp}>Sign up</button>
          <button onClick={handleSignIn}>Sign in</button>
          <button onClick={handleSignOut} type="button">Sign out</button>
          <button onClick={handleGetToken} type="button">getToken()</button>
          <button onClick={handleBootstrap} type="button">GET /api/bootstrap</button>
        </div>
      </form>

      <section style={{ marginTop: 16 }}>
        <strong>Log</strong>
        <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8, maxHeight: 400, overflow: 'auto' }}>
          {log.map((l) => `${l.at}  ${l.label}\n${JSON.stringify(l.value, null, 2)}\n\n`).join('')}
        </pre>
      </section>
    </div>
  );
}
