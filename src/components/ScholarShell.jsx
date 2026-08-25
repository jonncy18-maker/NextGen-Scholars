'use client';

import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { SignOutButton } from './SignOutButton.jsx';
import {
  IcnGrid,
  IcnWallet,
  IcnBook,
  IcnGlobe,
  IcnClock,
  IcnStar,
  IcnPlane,
  IcnHome,
  IcnSignOut,
  IcnUpdate,
  IcnPie,
  IcnUsers,
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
export function scholarNavItems(scholarKey, active, isMentor) {
  const expensesOnly = isExpensesOnlyScholar(scholarKey);

  // A mentor only gets the destinations they can actually reach. /budget is
  // the ONE scholar route that admits a mentor (ScholarAuthGate's allowMentor
  // — safe there because every fetch on it sends ?scholar=). Every other item
  // below gates on the scholar's own key, so offering them to a mentor is a
  // link straight into her sign-in screen: it reads as being kicked out to a
  // login page, which is exactly what it is.
  //
  // Fixing that by spreading allowMentor to those screens is NOT the move —
  // they don't scope their fetches (bootstrap/grades/english return every
  // scholar's rows to a mentor caller), which is the cross-scholar corruption
  // the note on mayView() describes. Scope a screen's fetches first, then it
  // can join this list.
  if (isMentor) {
    return [
      {
        key: 'navigator',
        href: '/navigator',
        label: 'Back to Navigator',
        icon: <IcnUsers size={16} />,
      },
      {
        key: 'budget',
        href: `/budget/${scholarKey}`,
        label: 'Living Budget',
        icon: <IcnPie size={16} />,
      },
      { key: 'site', href: '/', label: 'Public Site', icon: <IcnHome size={16} /> },
    ].map((item) => (item.key === active ? { ...item, active: true } : item));
  }

  return [
    {
      key: 'overview',
      href: `/home/${scholarKey}`,
      label: 'Overview',
      icon: <IcnGrid size={16} />,
    },
    {
      key: 'finances',
      href: `/entry?scholar=${scholarKey}`,
      label: 'Finances',
      icon: <IcnWallet size={16} />,
    },
    // The scholar's OWN living budget (her allowance), distinct from
    // 'finances' above, which is the sponsor-funded expense entry.
    {
      key: 'budget',
      href: `/budget/${scholarKey}`,
      label: 'My Budget',
      icon: <IcnPie size={16} />,
    },
    {
      key: 'academics',
      href: `/grades/${scholarKey}`,
      label: 'Academics',
      icon: <IcnBook size={16} />,
    },
    !expensesOnly && {
      key: 'english',
      href: `/english/${scholarKey}`,
      label: 'English (OET)',
      icon: <IcnGlobe size={16} />,
    },
    !expensesOnly && {
      key: 'immersion',
      href: 'https://next-gen-immersion.vercel.app/',
      label: 'Immersion App',
      icon: <IcnClock size={16} />,
      external: true,
    },
    !expensesOnly && {
      key: 'milestones',
      href: `/milestones/${scholarKey}`,
      label: 'Milestones',
      icon: <IcnStar size={16} />,
    },
    !expensesOnly && {
      key: 'travel',
      href: `/vacation/${scholarKey}`,
      label: 'Travel',
      icon: <IcnPlane size={16} />,
    },
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
  // A mentor viewing this scholar's own route (allowMentor on the auth gate)
  // otherwise sits inside chrome that is visually identical to actually
  // being signed in as her — same sidebar, same brand link, same name up
  // top. isMentor drives a "Back to Navigator" way out plus a visible badge,
  // rather than a 9px muted label buried in the footer.
  const isMentor = identityRole === 'Mentor';

  return (
    <div className="sp-shell ds-shell">
      <Sidebar
        brand={{ href: isMentor ? '/navigator' : `/home/${scholarKey}` }}
        subtitle="Pathway Navigator"
        items={scholarNavItems(scholarKey, active, isMentor)}
        footer={
          <>
            {/* Signed-in identity, not the page's subject. Showing the
                scholar's name over the word "Mentor" read as "you are Claire,
                a mentor" — the exact confusion this whole flow is meant to
                dispel. A mentor sees their own role as the name and whose
                page they're on underneath. */}
            <div className="ds-identity" title={isMentor ? `Mentor — viewing ${name}` : name}>
              <span className="ds-avatar">{isMentor ? 'M' : name?.[0]}</span>
              <div className="ds-footer-label">
                <div className="ds-identity-name">{isMentor ? 'Mentor' : name}</div>
                {isMentor ? (
                  <div className="ds-identity-role is-mentor">Viewing {name}</div>
                ) : (
                  identityRole && <div className="ds-identity-role">{identityRole}</div>
                )}
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
            {eyebrow && (
              <div className="ds-topbar-eyebrow">
                {isMentor && <span className="ds-mentor-badge">Mentor view</span>}
                {eyebrow}
              </div>
            )}
            <h1 className="ds-topbar-title">{title}</h1>
            {subtitle && <div className="ds-topbar-sub">{subtitle}</div>}
          </div>
          <div className="ds-topbar-actions">
            <button
              className={`ds-icon-btn${checkingUpdate ? ' is-loading' : updateAvailable ? ' has-update' : ''}`}
              onClick={checkForUpdate}
              title={
                updateAvailable ? 'New version installed — tap to reload' : 'Check for app updates'
              }
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
