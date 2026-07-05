'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient, signIn, invalidateToken } from '../lib/auth-client.js';
import { api } from '../lib/api.js';

// Generic sign-in for the nav "Login" button — no name/person is picked up
// front. Real auth happens first; GET /api/me (role/scholar_key resolved
// server-side from user_profile) then decides where to send the person, so
// the destination is never guessed client-side and a growing scholar roster
// never needs to be enumerated in a picker (see HomePage.jsx's old
// "Who's signing in?" modal, which this replaces).
function destinationFor(me) {
  return me.role === 'mentor' ? '/navigator' : `/home/${me.scholarKey}`;
}

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const inputRef = useRef(null);
  // Same mount-check-abort pattern as ScholarAuthGate.jsx: a slow session
  // check that resolves after a fresh sign-in could otherwise clobber it.
  const mountCheckAbortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    mountCheckAbortRef.current = controller;
    authClient.getSession({ fetchOptions: { cache: 'no-store', signal: controller.signal } }).then(async ({ data }) => {
      if (cancelled) return;
      if (!data?.session) { setCheckingSession(false); return; }
      try {
        const me = await api.get('/me');
        if (!cancelled) router.replace(destinationFor(me));
      } catch {
        if (!cancelled) setCheckingSession(false);
      }
    }).catch(() => { if (!cancelled) setCheckingSession(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [router]);

  useEffect(() => {
    if (!checkingSession) inputRef.current?.focus();
  }, [checkingSession]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    mountCheckAbortRef.current?.abort();
    invalidateToken();

    const { error: authError } = await signIn.email({ email, password });
    if (authError) {
      setLoading(false);
      setError('Incorrect credentials — try again.');
      return;
    }

    try {
      const me = await api.get('/me');
      router.replace(destinationFor(me));
    } catch {
      invalidateToken();
      await authClient.signOut();
      setError('Could not verify your account — try again.');
      setLoading(false);
    }
  }

  if (checkingSession) return null;

  return (
    <div className="el-lock">
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Welcome <em>back</em></h1>
        <p className="el-sub">Sign in to continue</p>
        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={handleSubmit} autoComplete="off">
          <div className="el-field">
            <label className="el-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              ref={inputRef}
              className="el-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
            />
          </div>
          <div className="el-field">
            <label className="el-label" htmlFor="login-pw">Password</label>
            <input
              id="login-pw"
              className="el-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
            />
          </div>
          <div className={`el-err${error ? ' show' : ''}`}>{error}</div>
          <button type="submit" disabled={!email || !password || loading} className="el-btn">
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
        <Link href="/" className="el-back">← Back to NextGen Scholars</Link>
      </div>
    </div>
  );
}
