'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient, signIn, invalidateToken } from '../lib/auth-client.js';
import { api } from '../lib/api.js';
import { SignInFrame, SignInField, PasswordInput } from '../components/SignInFrame.jsx';

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
    authClient
      .getSession({ fetchOptions: { cache: 'no-store', signal: controller.signal } })
      .then(async ({ data }) => {
        if (cancelled) return;
        if (!data?.session) {
          setCheckingSession(false);
          return;
        }
        try {
          const me = await api.get('/me');
          if (!cancelled) router.replace(destinationFor(me));
        } catch {
          if (!cancelled) setCheckingSession(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
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

    // rememberMe: false makes Better Auth issue a browser-session cookie (no
    // Max-Age) instead of its default persistent one, so the login survives
    // page refreshes/navigation but clears when the browser is fully closed.
    const { error: authError } = await signIn.email({ email, password, rememberMe: false });
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
    <SignInFrame
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="One sign-in for mentors and scholars. We'll open the right dashboard for you."
      footer={
        <>
          <p>Trouble signing in? Message your mentor.</p>
          <Link href="/" className="si-back">
            ← Back to NextGen Scholars
          </Link>
        </>
      }
    >
      <form
        className={`si-form${error ? ' is-error' : ''}`}
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <SignInField id="login-email" label="Email">
          <input
            id="login-email"
            ref={inputRef}
            className="si-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoComplete="email"
          />
        </SignInField>
        <SignInField id="login-pw" label="Password">
          <PasswordInput
            id="login-pw"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
        </SignInField>
        <div className={`si-err${error ? ' show' : ''}`} role="alert">
          {error}
        </div>
        <button type="submit" disabled={!email || !password || loading} className="si-btn">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </SignInFrame>
  );
}
