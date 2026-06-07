import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(true);
    } else {
      onUnlock();
    }
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
