import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { authClient, signIn } from '../lib/auth-client.js';
import { api } from '../lib/api.js';

// Real Neon Auth (Better Auth) sign-in gate for scholar-facing pages —
// replaces ScholarLockGate's cosmetic shared password for scholars who have
// a real account. Verifies via GET /api/me (role/scholar_key resolved
// server-side from user_profile) rather than trusting anything client-side,
// so a scholar can never view another scholar's route by mistake or intent.
export function ScholarAuthGate({ scholarKey, name, onUnlock }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    authClient.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data?.session) { setCheckingSession(false); return; }
      try {
        const me = await api.get('/me');
        if (!cancelled && me.scholarKey === scholarKey) onUnlock();
      } catch {
        // fall through to the sign-in form
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }).catch(() => { if (!cancelled) setCheckingSession(false); });
    return () => { cancelled = true; };
  }, [scholarKey, onUnlock]);

  useEffect(() => {
    if (!checkingSession) inputRef.current?.focus();
  }, [checkingSession]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await signIn.email({ email, password });
    if (authError) {
      setLoading(false);
      setError('Incorrect credentials — try again.');
      return;
    }

    try {
      const me = await api.get('/me');
      if (me.scholarKey !== scholarKey) {
        await authClient.signOut();
        setError("This account isn't set up for this portal yet.");
        setLoading(false);
        return;
      }
      onUnlock();
    } catch {
      await authClient.signOut();
      setError('Could not verify your account — try again.');
      setLoading(false);
    }
  }

  if (checkingSession) return null;

  return (
    <div className="el-lock" data-scholar={scholarKey}>
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Welcome, <em>{name}</em></h1>
        <p className="el-sub">Sign in to continue</p>
        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={handleSubmit} autoComplete="off">
          <div className="el-field">
            <label className="el-label" htmlFor="sag-email">Email</label>
            <input
              id="sag-email"
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
            <label className="el-label" htmlFor="sag-pw">Password</label>
            <input
              id="sag-pw"
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
            {loading ? 'Signing in…' : `Continue as ${name} →`}
          </button>
        </form>
        <Link href="/" className="el-back">← Back to NextGen Scholars</Link>
      </div>
    </div>
  );
}
