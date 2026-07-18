'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IcnMenu, IcnX, IcnExternal } from './ShellIcons.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

// Shared left-rail shell for the mentor Navigator and ScholarHome. Desktop:
// fixed sidebar, collapsible to an icon-only rail (persisted). Below the
// shell breakpoint (see shell.css) it disappears behind a slim mobile header
// bar with a hamburger that opens the same rail as an off-canvas drawer —
// state stays internal so pages don't have to wire it. Nav items are plain
// <Link>s; the drawer closes on item click.
export function Sidebar({ brand, subtitle, items, footer }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage('ngs_sidebar_collapsed', false);

  const brandLink = (
    <Link className="ds-brand" href={brand?.href || '/'} onClick={() => setOpen(false)}>
      <Image
        className="ds-brand-emblem"
        src="/icons/icon-192.png"
        alt=""
        width={30}
        height={30}
        priority
      />
      <span className="ds-brand-text">
        <span className="ds-brand-name">
          NextGen
          <br />
          Scholars
        </span>
        <span className="ds-brand-sub">{subtitle}</span>
      </span>
    </Link>
  );

  const rail = (
    <>
      <nav className="ds-nav">
        {items.map((item) =>
          item.external ? (
            <a
              key={item.key}
              className="ds-nav-item"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={item.label}
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
              title={item.label}
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
          <Image src="/icons/icon-192.png" alt="" width={26} height={26} priority />
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

      {/* desktop rail — toggle + brand share a row so the nav list below
          starts higher and fits without scrolling on typical viewports. */}
      <aside className={`ds-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="ds-sidebar-head">
          <button
            className="ds-collapse-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <IcnMenu size={16} />
          </button>
          {brandLink}
        </div>
        {rail}
      </aside>

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
            {brandLink}
            {rail}
          </aside>
        </div>
      )}
    </>
  );
}
