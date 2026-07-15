'use client';

import React, { useState, useEffect } from 'react';

// Light/dark switch for the dashboard shells. The pre-paint script in
// app/layout.jsx already stamped data-theme on <html>; this just reads it
// after mount (SSR renders a neutral placeholder to avoid hydration
// mismatch) and flips it + persists the choice.
export function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ngs_theme', next);
    } catch {
      /* private mode — theme still applies for this page load */
    }
    setTheme(next);
  }

  return (
    <button
      className="ds-theme-toggle"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle color theme"
    >
      <span className={`ds-theme-opt${theme === 'light' ? ' is-on' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
        </svg>
        <span className="ds-footer-label">Light</span>
      </span>
      <span className={`ds-theme-opt${theme === 'dark' ? ' is-on' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
        <span className="ds-footer-label">Dark</span>
      </span>
    </button>
  );
}
