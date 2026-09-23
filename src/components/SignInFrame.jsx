'use client';

import React, { useState } from 'react';

// Shared split-screen layout for every sign-in surface — the generic /login,
// the per-scholar ScholarAuthGate and the Navigator LockScreen — so the three
// can't drift apart visually. Left: the program's pathway (hidden on phones
// down to a compact strip); right: the caller's form inside a card. Each
// caller keeps its own auth logic; this component only draws.
const PATHWAY = [
  { name: 'BSN · Philippines', note: 'Grades, GPA and semester budgets' },
  { name: 'OET', note: 'English immersion hours' },
  { name: 'NCLEX-RN', note: 'Licensure exam' },
  { name: 'AHPRA · Australia', note: 'Registration as a nurse' },
];

export function SignInFrame({ eyebrow, title, subtitle, notice, children, footer, scholar }) {
  return (
    <div className="si" data-scholar={scholar}>
      <aside className="si-story">
        <div className="si-brand">
          <span className="si-mark">NGS</span>
          <span className="si-brand-name">NextGen Scholars</span>
        </div>
        <div className="si-pitch">
          <p className="si-headline">
            Every step of the pathway, <em>in one place.</em>
          </p>
          <ol className="si-path">
            {PATHWAY.map((p, i) => (
              <li key={p.name} className={i === 0 ? 'is-first' : ''}>
                <span className="si-path-dot" />
                <span className="si-path-text">
                  <b>{p.name}</b>
                  <span>{p.note}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <span className="si-foot">A private mentorship program</span>
      </aside>
      <main className="si-main">
        <div className="si-card">
          <div className="si-head">
            {eyebrow && <span className="si-eyebrow">{eyebrow}</span>}
            <h1 className="si-title">{title}</h1>
            {subtitle && <p className="si-sub">{subtitle}</p>}
          </div>
          {notice && <div className="si-notice">{notice}</div>}
          {children}
          {footer && <div className="si-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function SignInField({ id, label, children }) {
  return (
    <div className="si-field">
      <label className="si-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

// Password input with a show/hide toggle. The toggle is type="button" so
// pressing it never submits the surrounding form.
export function PasswordInput({ id, value, onChange, inputRef, placeholder = 'Your password' }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="si-pw">
      <input
        id={id}
        ref={inputRef}
        className="si-input"
        type={shown ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="si-pw-toggle"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 20L20 4" />}
        </svg>
      </button>
    </div>
  );
}
