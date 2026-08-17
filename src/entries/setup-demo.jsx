'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signUp } from '../lib/auth-client.js';

// ── TEMPORARY — DELETE THIS FILE AND app/setup-demo/page.jsx AFTER USE ─────
// One-shot page for creating the demo sandbox scholar's Better Auth account.
// No UI in this app self-serves account creation (LockScreen/ScholarAuthGate/
// LoginPage only sign in), and the environment Claude Code runs in is network-
// blocked from the Neon Auth domain, so the account cannot be created from
// there. An identical page existed briefly in PR #246 and was removed once it
// had served its purpose; do the same here.
//
// Deliberately near-zero surface while it does exist: the email and name are
// hardcoded below, so this page can only ever attempt to create this one
// specific account — a stranger who guessed the URL could not register
// themselves, and once the account exists Better Auth rejects the duplicate.
// It is also unlinked (nothing in the app routes here) and grants nothing on
// its own: every app/api/** route 403s without a matching user_profile row,
// which is added separately in Neon.
const DEMO_EMAIL = 'jbshaw.cpa@gmail.com';
const DEMO_NAME = 'Demo Scholar';
const MIN_PASSWORD = 8;

export function SetupDemoPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | done
  const [error, setError] = useState(null);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_PASSWORD && password === confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!ready) return;
    setState('saving');
    setError(null);

    const { error: authError } = await signUp.email({
      email: DEMO_EMAIL,
      password,
      name: DEMO_NAME,
    });

    if (authError) {
      // Surface the real reason here rather than the generic "Incorrect
      // credentials" the sign-in screens show. This page is a one-off setup
      // tool for the owner, not a public surface where a precise error
      // would leak whether an account exists — and the most likely failure
      // (the account already exists) is one you need to be able to read.
      setError(authError.message || 'Could not create the account — see the console for detail.');
      setState('idle');
      return;
    }

    setState('done');
  }

  if (state === 'done') {
    return (
      <div className="el-lock">
        <div className="el-lock-bg" />
        <div className="el-lock-inner">
          <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
          <h1 className="el-title">Account <em>created</em></h1>
          <p className="el-sub" style={{ lineHeight: 1.7 }}>
            {DEMO_EMAIL} now exists in Neon Auth.
            <br /><br />
            It cannot sign in yet — a matching <code>user_profile</code> row
            (role <code>scholar</code>, key <code>demo</code>) still has to be
            added in Neon. Tell Claude this step is done and it will add it.
          </p>
          <Link href="/" className="el-back">← Back to NextGen Scholars</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="el-lock">
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Set up the <em>demo</em> account</h1>
        <p className="el-sub">One-time setup · {DEMO_EMAIL}</p>
        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={handleSubmit} autoComplete="off">
          <div className="el-field">
            <label className="el-label" htmlFor="demo-pw">Choose a password</label>
            <input
              id="demo-pw"
              className="el-input"
              type="password"
              placeholder={`At least ${MIN_PASSWORD} characters`}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoComplete="new-password"
            />
          </div>
          <div className="el-field">
            <label className="el-label" htmlFor="demo-pw2">Confirm password</label>
            <input
              id="demo-pw2"
              className="el-input"
              type="password"
              placeholder="Type it again"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null); }}
              autoComplete="new-password"
            />
          </div>
          <div className={`el-err${(error || tooShort || mismatch) ? ' show' : ''}`}>
            {error
              || (tooShort ? `Password must be at least ${MIN_PASSWORD} characters.` : '')
              || (mismatch ? 'The two passwords do not match.' : '')}
          </div>
          <button type="submit" disabled={!ready || state === 'saving'} className="el-btn">
            {state === 'saving' ? 'Creating…' : 'Create account →'}
          </button>
        </form>
        <Link href="/" className="el-back">← Back to NextGen Scholars</Link>
      </div>
    </div>
  );
}
