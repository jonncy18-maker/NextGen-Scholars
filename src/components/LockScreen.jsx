import React, { useState, useEffect, useRef } from 'react';
import { signIn } from '../lib/auth-client.js';
import { supabase } from '../lib/supabase.js';

// Real Neon Auth (Better Auth) sign-in — was Supabase Auth's
// signInWithPassword() before the neon-migration branch. Role (mentor vs.
// scholar) is never checked client-side; every API route re-verifies it
// server-side from user_profile, so a non-mentor account that signs in here
// simply gets 401/403s on data calls (Navigator falls back to its existing
// "static data" offline state rather than crashing — see navigator.jsx's
// loadFromSupabase().catch()).
//
// Also fires a best-effort Supabase Auth sign-in with the same credentials:
// DocumentsSection.jsx still calls supabase.auth.getSession() for the
// drive-proxy/ask Edge Functions, which aren't ported to Neon yet (Phase B5).
// Until that lands, both sessions need to exist side by side. This doesn't
// block unlock if it fails — Drive/ask calls already handle a missing
// session with their own "Session expired" messaging.
export function LockScreen({ isHiding, onUnlock }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    document.body.style.overflow = isHiding ? '' : 'hidden';
  }, [isHiding]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const { error: authError } = await signIn.email({ email, password });
    setLoading(false);
    if (authError) {
      setError(true);
      return;
    }
    supabase.auth.signInWithPassword({ email, password }).catch(() => {
      // Best-effort — see file header comment. Drive/ask calls handle a
      // missing Supabase session gracefully on their own.
    });
    onUnlock();
  }

  return (
    <div id="lock" className={isHiding ? 'is-hidden' : ''}>
      <div className="lock-bg" />
      <div className="lock-inner">
        <div className="lock-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="lock-title">Pathway <em>Navigator</em></h1>
        <div className="lock-sub">Mentor access only</div>
        <form className={`lock-form${error ? ' is-error' : ''}`} onSubmit={handleSubmit} autoComplete="off">
          <input
            ref={inputRef}
            className="lock-input"
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(false); }}
          />
          <input
            className="lock-input"
            type="password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
          />
          <div className={`lock-err${error ? ' show' : ''}`}>Incorrect credentials — try again.</div>
          <button className="lock-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Unlock dashboard'}
          </button>
        </form>
        <div className="lock-hint">Private operations console · NextGen Scholars · Phase 1</div>
      </div>
    </div>
  );
}
