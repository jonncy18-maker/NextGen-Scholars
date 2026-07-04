import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase.js';

async function loadConfig() {
  try {
    const { data } = await supabase.from('config').select('key, value');
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    return map;
  } catch {
    return {};
  }
}

// Shared password gate for scholar-facing pages.
// Scholar identity comes from the URL (scholarKey prop) — no username needed.
// On success, writes sessionStorage so sibling pages skip the gate.
export function ScholarLockGate({ scholarKey, name, onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(false);
  const [config, setConfig]     = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { loadConfig().then(setConfig); }, []);
  useEffect(() => { if (config) inputRef.current?.focus(); }, [config]);

  function unlock(e) {
    e.preventDefault();
    const expected = config?.[`${scholarKey}_password`];
    if (expected && password === expected) {
      sessionStorage.setItem('ngs_auth_scholar', scholarKey);
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <div className="el-lock" data-scholar={scholarKey}>
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Welcome, <em>{name}</em></h1>
        <p className="el-sub">Enter your password to continue</p>
        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={unlock} autoComplete="off">
          <div className="el-field">
            <label className="el-label" htmlFor="sl-pw">Password</label>
            <input
              id="sl-pw"
              ref={inputRef}
              className="el-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              disabled={!config}
              autoComplete="current-password"
            />
          </div>
          <div className={`el-err${error ? ' show' : ''}`}>Incorrect password — try again.</div>
          <button type="submit" disabled={!config || !password} className="el-btn">
            {config ? `Continue as ${name} →` : 'Loading…'}
          </button>
        </form>
        <Link href="/" className="el-back">← Back to NextGen Scholars</Link>
      </div>
    </div>
  );
}
