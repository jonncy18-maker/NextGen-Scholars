import React, { useState, useEffect, useRef } from 'react';
import { signIn } from '../lib/auth-client.js';
import { SignInFrame, SignInField, PasswordInput } from './SignInFrame.jsx';

// Real Neon Auth (Better Auth) sign-in — was Supabase Auth's
// signInWithPassword() before the neon-migration branch. Role (mentor vs.
// scholar) is never checked client-side; every API route re-verifies it
// server-side from user_profile, so a non-mentor account that signs in here
// simply gets 401/403s on data calls (Navigator falls back to its existing
// "static data" offline state rather than crashing — see navigator.jsx's
// loadFromSupabase().catch()).
//
// Used to also fire a best-effort parallel Supabase Auth sign-in for the
// ask Edge Functions -- removed now that Phase B5 ported those to
// Neon-backed /api/ask, /api/ask-scholar, /api/ask-public.
// Nothing in the mentor-facing app calls supabase.auth.* anymore.
// sessionExpired: true when this lock is showing because a live session died
// mid-use (not the normal first-load/sign-out case) — shown as a plain-language
// banner so an automatic re-lock never reads as an unexplained, alarming
// logout (see the "approved expenses disappeared" incident, 2026-07-12: the
// old silent-failure behavior was the confusing thing, not the re-lock itself).
export function LockScreen({ isHiding, onUnlock, sessionExpired }) {
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
    // rememberMe: false issues a browser-session cookie instead of Better
    // Auth's default persistent one, so it clears when the browser closes.
    const { error: authError } = await signIn.email({ email, password, rememberMe: false });
    setLoading(false);
    if (authError) {
      setError(true);
      return;
    }
    onUnlock();
  }

  return (
    <div id="lock" className={isHiding ? 'is-hidden' : ''}>
      <SignInFrame
        eyebrow="Mentor access only"
        title={
          <>
            Pathway <em>Navigator</em>
          </>
        }
        subtitle="The private operations console for NextGen Scholars."
        notice={sessionExpired && 'Your session expired — sign in again to see the latest updates.'}
      >
        <form
          className={`si-form${error ? ' is-error' : ''}`}
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          <SignInField id="lock-email" label="Email">
            <input
              id="lock-email"
              ref={inputRef}
              className="si-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
              autoComplete="email"
            />
          </SignInField>
          <SignInField id="lock-pw" label="Password">
            <PasswordInput
              id="lock-pw"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
            />
          </SignInField>
          <div className={`si-err${error ? ' show' : ''}`} role="alert">
            {error && 'Incorrect credentials — try again.'}
          </div>
          <button className="si-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Unlock dashboard'}
          </button>
        </form>
      </SignInFrame>
    </div>
  );
}
