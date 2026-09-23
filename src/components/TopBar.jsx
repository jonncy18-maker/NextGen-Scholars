'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IcnMenu, IcnX, IcnExternal } from './ShellIcons.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

// Shared top-bar shell for the mentor Navigator and every scholar screen
// (replaced the old left Sidebar in the 2026-09 "People first" redesign).
//
// `groups` is the whole nav tree: [{ key, label, href, active, badge,
// items: [{ key, label, href, active, external, badge }] }]. Desktop shows
// the groups in the bar and the active group's items as a tabs row under it
// (only when it has more than one). Below the shell breakpoint (shell.css)
// the bar collapses to brand + menu button, and the drawer lists every group
// with its items so nothing is more than one tap deeper than on desktop.
//
// `account` fills the avatar menu: { initial, name, role, status, links,
// signOut } — `status` and `signOut` are nodes because the mentor and
// scholar shells own different sign-out flows and connection indicators.
export function TopBar({ brand, groups, actions, account }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeGroup = groups.find((g) => g.active);
  const tabs = activeGroup?.items?.length > 1 ? activeGroup.items : null;

  return (
    <>
      <header className="ds-top">
        <div className="ds-top-inner">
          <Link className="ds-top-brand" href={brand.href}>
            <span className="ds-top-mark">NGS</span>
            <span className="ds-top-name">{brand.label}</span>
          </Link>
          <nav className="ds-top-nav" aria-label="Main">
            {groups.map((g) => (
              <NavLink key={g.key} item={g} className="ds-top-link" />
            ))}
          </nav>
          <div className="ds-top-actions">{actions}</div>
          <AccountMenu account={account} />
          <button
            type="button"
            className="ds-top-menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <IcnMenu size={20} />
          </button>
        </div>
        {tabs && (
          <nav className="ds-tabs" aria-label={`${activeGroup.label} sections`}>
            <div className="ds-tabs-inner">
              {tabs.map((t) => (
                <NavLink key={t.key} item={t} className="ds-tab" />
              ))}
            </div>
          </nav>
        )}
      </header>

      {drawerOpen && (
        <div className="ds-drawer-scrim" onClick={() => setDrawerOpen(false)}>
          <aside
            className="ds-drawer"
            role="dialog"
            aria-label="Navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ds-drawer-head">
              <span className="ds-top-brand">
                <span className="ds-top-mark">NGS</span>
                <span className="ds-top-name">{brand.label}</span>
              </span>
              <button
                type="button"
                className="ds-top-menu"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
              >
                <IcnX size={20} />
              </button>
            </div>
            <nav className="ds-drawer-nav" aria-label="Main">
              {groups.map((g) =>
                g.items?.length > 1 ? (
                  <div key={g.key} className="ds-drawer-group">
                    <span className="ds-drawer-label">{g.label}</span>
                    {g.items.map((t) => (
                      <NavLink
                        key={t.key}
                        item={t}
                        className="ds-drawer-link"
                        onNavigate={() => setDrawerOpen(false)}
                      />
                    ))}
                  </div>
                ) : (
                  <NavLink
                    key={g.key}
                    item={g}
                    className="ds-drawer-link"
                    onNavigate={() => setDrawerOpen(false)}
                  />
                )
              )}
            </nav>
            {actions && <div className="ds-drawer-actions">{actions}</div>}
            <div className="ds-drawer-foot">
              <AccountSummary account={account} />
              <ThemeToggle />
              {account.signOut}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function NavLink({ item, className, onNavigate }) {
  const cls = `${className}${item.active ? ' is-active' : ''}`;
  const badge = item.badge > 0 && <span className="ds-top-badge">{item.badge}</span>;
  if (item.external) {
    return (
      <a className={cls} href={item.href} target="_blank" rel="noopener noreferrer">
        {item.label}
        <IcnExternal size={11} />
      </a>
    );
  }
  return (
    <Link
      className={cls}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      onClick={onNavigate}
    >
      {item.label}
      {badge}
    </Link>
  );
}

function AccountSummary({ account }) {
  return (
    <div className="ds-acct-who">
      <span className="ds-avatar">{account.initial}</span>
      <div>
        <div className="ds-acct-name">{account.name}</div>
        {account.role && <div className="ds-acct-role">{account.role}</div>}
      </div>
    </div>
  );
}

function AccountMenu({ account }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ds-acct" ref={wrapRef}>
      <button
        type="button"
        className="ds-acct-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        title={account.name}
      >
        {account.initial}
      </button>
      {open && (
        <div className="ds-acct-menu">
          <AccountSummary account={account} />
          {account.status}
          <ThemeToggle />
          {(account.links || []).map((l) =>
            l.onClick ? (
              <button
                key={l.key}
                type="button"
                className="ds-acct-item"
                onClick={() => {
                  setOpen(false);
                  l.onClick();
                }}
              >
                {l.label}
              </button>
            ) : l.external ? (
              <a
                key={l.key}
                className="ds-acct-item"
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l.label} <IcnExternal size={11} />
              </a>
            ) : (
              <Link key={l.key} className="ds-acct-item" href={l.href}>
                {l.label}
              </Link>
            )
          )}
          {account.signOut}
        </div>
      )}
    </div>
  );
}
