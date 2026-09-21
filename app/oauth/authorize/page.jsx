'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, getToken, invalidateToken } from '../../../src/lib/auth-client.js';

// The human-facing half of the OAuth flow in lib/oauth.js: a real mentor
// sign-in (reusing the same Better Auth session every other mentor page
// uses) followed by an explicit consent step before an authorization code is
// minted. No scholar path here — only a mentor account may grant an MCP
// client full read/write access, same scope as a manually-generated
// mcp_api_keys row.
export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <OAuthAuthorizeInner />
    </Suspense>
  );
}

function OAuthAuthorizeInner() {
  const params = useSearchParams();
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');
  const codeChallenge = params.get('code_challenge');
  const codeChallengeMethod = params.get('code_challenge_method');
  const responseType = params.get('response_type');

  const [phase, setPhase] = useState('checking'); // checking | signin | consent | denied | error
  const [errorMsg, setErrorMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signinError, setSigninError] = useState(false);
  const [busy, setBusy] = useState(false);

  const missing = !clientId || !redirectUri || !codeChallenge || responseType !== 'code';

  useEffect(() => {
    if (missing) {
      setErrorMsg('This link is missing required parameters — ask the app you were connecting to try again.');
      setPhase('error');
      return;
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSession() {
    const token = await getToken();
    if (!token) {
      setPhase('signin');
      return;
    }
    const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setPhase('signin');
      return;
    }
    const me = await res.json();
    if (me.role !== 'mentor') {
      setErrorMsg('Only the mentor account can authorize this connector.');
      setPhase('error');
      return;
    }
    setPhase('consent');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true);
    setSigninError(false);
    const { error } = await signIn.email({ email, password, rememberMe: false });
    setBusy(false);
    if (error) {
      setSigninError(true);
      return;
    }
    invalidateToken();
    await checkSession();
  }

  async function handleApprove() {
    setBusy(true);
    const token = await getToken();
    const res = await fetch('/api/oauth/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        state,
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.redirect) {
      setErrorMsg(data?.error_description || 'Could not complete authorization.');
      setPhase('error');
      return;
    }
    window.location.href = data.redirect;
  }

  function handleDeny() {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  return (
    <div style={styles.page}>
      <style>{`:root{color-scheme:light dark}`}</style>
      <div style={styles.card}>
        <div style={styles.badge}>NGS</div>
        <h1 style={styles.title}>Connect to NextGen Scholars</h1>

        {phase === 'checking' && <p style={styles.muted}>Checking your session…</p>}

        {phase === 'error' && (
          <p style={{ ...styles.muted, color: '#B4463F' }}>{errorMsg}</p>
        )}

        {phase === 'signin' && (
          <>
            <p style={styles.muted}>Sign in as the program mentor to continue.</p>
            <form onSubmit={handleSignIn} style={styles.form}>
              <input
                style={styles.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSigninError(false); }}
                autoComplete="username"
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setSigninError(false); }}
                autoComplete="current-password"
              />
              {signinError && <div style={styles.error}>Incorrect credentials — try again.</div>}
              <button style={styles.primaryBtn} type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}

        {phase === 'consent' && (
          <>
            <p style={styles.muted}>
              This will let the connecting app read and change your program's data — expenses, grades, English
              tracking, submissions, alerts, and more — with the same access you have as mentor.
            </p>
            <div style={styles.btnRow}>
              <button style={styles.secondaryBtn} onClick={handleDeny} disabled={busy}>
                Deny
              </button>
              <button style={styles.primaryBtn} onClick={handleApprove} disabled={busy}>
                {busy ? 'Connecting…' : 'Approve'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ngs-navy-deep, #131F38)',
    fontFamily: 'Manrope, system-ui, sans-serif',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--ngs-navy, #1B2A4A)',
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  },
  badge: {
    display: 'inline-block',
    color: 'var(--ngs-gold, #C9A84C)',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 13,
    letterSpacing: '0.15em',
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 22, margin: '0 0 12px', fontFamily: 'Newsreader, serif' },
  muted: { color: '#B9C2D6', fontSize: 14.5, lineHeight: 1.5, margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
  },
  error: { color: '#E8918A', fontSize: 13 },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  primaryBtn: {
    background: 'var(--ngs-gold, #C9A84C)',
    color: '#1B2A4A',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'transparent',
    color: '#B9C2D6',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '10px 18px',
    cursor: 'pointer',
  },
};
