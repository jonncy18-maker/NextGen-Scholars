import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext.jsx';

export function LockScreen({ isHiding, onUnlock }) {
  const { D } = useData();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    document.body.style.overflow = isHiding ? '' : 'hidden';
  }, [isHiding]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === D.config.password) {
      onUnlock();
    } else {
      setError(true);
      inputRef.current?.select();
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
            type="password"
            placeholder="Enter passphrase"
            aria-label="Passphrase"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
          />
          <div className={`lock-err${error ? ' show' : ''}`}>Incorrect passphrase — try again.</div>
          <button className="lock-btn" type="submit">Unlock dashboard</button>
        </form>
        <div className="lock-hint">Private operations console · NextGen Scholars · Phase 1</div>
      </div>
    </div>
  );
}
