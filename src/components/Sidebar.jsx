'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { IcnMenu, IcnX, IcnExternal } from './ShellIcons.jsx';

// Shared left-rail shell for the mentor Navigator and ScholarHome. Desktop:
// fixed sidebar. Below the shell breakpoint (see shell.css) it disappears
// behind a slim mobile header bar with a hamburger that opens the same rail
// as an off-canvas drawer — state stays internal so pages don't have to
// wire it. Nav items are plain <Link>s; the drawer closes on item click.
export function Sidebar({ brand, subtitle, items, footer }) {
  const [open, setOpen] = useState(false);

  const rail = (
    <>
      <Link className="ds-brand" href={brand?.href || '/'} onClick={() => setOpen(false)}>
        <span className="ds-brand-emblem" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            {/* laurel-flanked flame — nods to the mockup emblem without an asset */}
            <path d="M12 4c1.8 2 2.6 3.6 2.6 5.2A2.6 2.6 0 0 1 12 11.8a2.6 2.6 0 0 1-2.6-2.6C9.4 7.6 10.2 6 12 4z" />
            <path d="M5.5 9c0 4.5 2 7.5 6.5 9.5M18.5 9c0 4.5-2 7.5-6.5 9.5" />
            <path d="M4.5 13.5C5.8 14 6.8 14.8 7.5 16M19.5 13.5c-1.3.5-2.3 1.3-3 2.5" />
          </svg>
        </span>
        <span className="ds-brand-text">
          <span className="ds-brand-name">
            NextGen
            <br />
            Scholars
          </span>
          <span className="ds-brand-sub">{subtitle}</span>
        </span>
      </Link>

      <nav className="ds-nav">
        {items.map((item) =>
          item.external ? (
            <a
              key={item.key}
              className="ds-nav-item"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="ds-nav-icon">{item.icon}</span>
              <span className="ds-nav-label">{item.label}</span>
              <span className="ds-nav-ext"><IcnExternal size={12} /></span>
            </a>
          ) : (
            <Link
              key={item.key}
              className={`ds-nav-item${item.active ? ' is-active' : ''}`}
              href={item.href}
              onClick={() => setOpen(false)}
            >
              <span className="ds-nav-icon">{item.icon}</span>
              <span className="ds-nav-label">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ds-nav-badge">{item.badge}</span>
              )}
            </Link>
          )
        )}
      </nav>

      <div className="ds-side-footer">{footer}</div>
    </>
  );

  return (
    <>
      {/* mobile header — hidden on desktop */}
      <header className="ds-mobile-bar">
        <Link className="ds-mobile-brand" href={brand?.href || '/'}>
          <span className="ngs-mark ngs-mark-sm"><span>N</span><span>G</span><span>S</span></span>
          <span className="ds-mobile-title">{subtitle}</span>
        </Link>
        <button
          className="ds-mobile-menu"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <IcnMenu size={20} />
        </button>
      </header>

      {/* desktop rail */}
      <aside className="ds-sidebar">{rail}</aside>

      {/* off-canvas drawer (mobile) */}
      {open && (
        <div className="ds-drawer-scrim" onClick={() => setOpen(false)}>
          <aside className="ds-sidebar ds-sidebar--drawer" onClick={(e) => e.stopPropagation()}>
            <button
              className="ds-drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
            >
              <IcnX size={18} />
            </button>
            {rail}
          </aside>
        </div>
      )}
    </>
  );
}
