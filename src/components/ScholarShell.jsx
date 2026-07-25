'use client';

import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { SignOutButton } from './SignOutButton.jsx';
import {
  IcnGrid, IcnWallet, IcnBook, IcnGlobe, IcnClock,
  IcnStar, IcnPlane, IcnHome, IcnSignOut, IcnUpdate,
} from './ShellIcons.jsx';
import { useAppUpdate } from '../hooks/useAppUpdate.js';

// Shared scholar-side shell — the same sidebar/topbar chrome ScholarHome got
// in the dashboard redesign, extracted so the scholar's *other* modules
// (Finances, Academics, English, Milestones, Travel) live inside it too.
//
// They didn't, originally: the redesign rebuilt MentorHome and ScholarHome
// only. That was enough on the mentor side because every mentor section
// renders inside navigator.jsx's slug router and inherited the shell for
// free — but each scholar module is its own route, so they all kept the old
// standalone `.sp-page` header with a "← Back to home" text link. The result
// was a sidebar that advertised five destinations and dropped you out of the
// shell the moment you picked one, and (because the dark palette is only
// consumed by the .nav-app/.sp-shell trees) a jump back to a white page for
// anyone using dark mode.

// Janndilyne is TESDA-track: no English/OET, milestones or travel modules.
// Same rule ScholarHome applies for its own nav and stat cards.
export function isExpensesOnlyScholar(scholarKey) {
  return scholarKey === 'janndilyne';
}

// Single source of truth for the scholar sidebar's destinations. ScholarHome
// and every module below call this with their own `active` key, so the nav
// can't drift between them (it previously existed only as an inline array in
// ScholarHome).
export function scholarNavItems(scholarKey, active) {
  const expensesOnly = isExpensesOnlyScholar(scholarKey);
  return [
    { key: 'overview', href: `/home/${scholarKey}`, label: 'Overview', icon: <IcnGrid size={16} /> },
    { key: 'finances', href: `/entry?scholar=${scholarKey}`, label: 'Finances', icon: <IcnWallet size={16} /> },
    { key: 'academics', href: `/grades/${scholarKey}`, label: 'Academics', icon: <IcnBook size={16} /> },
    !expensesOnly && { key: 'english', href: `/english/${scholarKey}`, label: 'English (OET)', icon: <IcnGlobe size={16} /> },
    !expensesOnly && { key: 'immersion', href: 'https://next-gen-immersion.vercel.app/', label: 'Immersion App', icon: <IcnClock size={16} />, external: true },
    !expensesOnly && { key: 'milestones', href: `/milestones/${scholarKey}`, label: 'Milestones', icon: <IcnStar size={16} /> },
    !expensesOnly && { key: 'travel', href: `/vacation/${scholarKey}`, label: 'Travel', icon: <IcnPlane size={16} /> },
    { key: 'site', href: '/', label: 'Public Site', icon: <IcnHome size={16} /> },
  ]
    .filter(Boolean)
    .map((item) => (item.key === active ? { ...item, active: true } : item));
}

// `active` selects the highlighted nav item; `eyebrow`/`title`/`subtitle`
// fill the topbar (ScholarHome uses a time-of-day greeting there, the
// modules use the module name). `identityRole` is the small line under the
// scholar's name in the sidebar footer. onSignOut is forwarded so each
// screen can reset its own auth/data state before the redirect.
export function ScholarShell({
  scholarKey,
  name,
  active,
  eyebrow,
  title,
  subtitle,
  identityRole,
  onSignOut,
  children,
}) {
  const { checking: checkingUpdate, available: updateAvailable, checkForUpdate } = useAppUpdate();

  return (
    <div className="sp-shell ds-shell">
      <Sidebar
        brand={{ href: `/home/${scholarKey}` }}
        subtitle="Pathway Navigator"
        items={scholarNavItems(scholarKey, active)}
        footer={
          <>
            <div className="ds-identity" title={name}>
              <span className="ds-avatar">{name?.[0]}</span>
              <div className="ds-footer-label">
                <div className="ds-identity-name">{name}</div>
                {identityRole && <div className="ds-identity-role">{identityRole}</div>}
              </div>
            </div>
            <ThemeToggle />
            <SignOutButton className="ds-signout" onSignOut={onSignOut}>
              <IcnSignOut size={13} /> <span className="ds-footer-label">Sign out</span>
            </SignOutButton>
          </>
        }
      />
      <div className="ds-main">
        <header className="ds-topbar">
          <div>
            {eyebrow && <div className="ds-topbar-eyebrow">{eyebrow}</div>}
            <h1 className="ds-topbar-title">{title}</h1>
            {subtitle && <div className="ds-topbar-sub">{subtitle}</div>}
          </div>
          <div className="ds-topbar-actions">
            <button
              className={`ds-icon-btn${checkingUpdate ? ' is-loading' : updateAvailable ? ' has-update' : ''}`}
              onClick={checkForUpdate}
              title={updateAvailable ? 'New version installed — tap to reload' : 'Check for app updates'}
            >
              <IcnUpdate size={15} />
            </button>
          </div>
        </header>
        <main className="ds-content">{children}</main>
      </div>
    </div>
  );
}
