'use client';

import React from 'react';
import Link from 'next/link';
import { TopBar } from './TopBar.jsx';
import { SignOutButton } from './SignOutButton.jsx';
import { IcnSignOut } from './ShellIcons.jsx';
import { useAppUpdate } from '../hooks/useAppUpdate.js';

// Shared scholar-side shell — the same top-bar chrome ScholarHome got
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

// Single source of truth for the scholar top bar's destinations. ScholarHome
// and every module below call this with their own `active` key, so the nav
// can't drift between them. Five groups (People-first redesign): the bar
// shows the groups, and a group with more than one page gets a tabs row.
export function scholarNavGroups(scholarKey, active, isMentor) {
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
  const groups = isMentor
    ? [
        { key: 'navigator', label: 'Back to Navigator', href: '/navigator' },
        { key: 'budget', label: 'Living Budget', href: `/budget/${scholarKey}` },
      ]
    : [
        { key: 'overview', label: 'Home', href: `/home/${scholarKey}` },
        {
          key: 'money',
          label: 'Money',
          items: [
            { key: 'finances', label: 'Expenses', href: `/entry?scholar=${scholarKey}` },
            // The scholar's OWN living budget (her allowance), distinct from
            // 'finances' above, which is the sponsor-funded expense entry.
            { key: 'budget', label: 'My budget', href: `/budget/${scholarKey}` },
          ],
        },
        { key: 'academics', label: 'Grades', href: `/grades/${scholarKey}` },
        !expensesOnly && {
          key: 'english-group',
          label: 'English',
          items: [
            { key: 'english', label: 'OET hours', href: `/english/${scholarKey}` },
            {
              key: 'immersion',
              label: 'Immersion app',
              href: 'https://next-gen-immersion.vercel.app/',
              external: true,
            },
          ],
        },
        !expensesOnly && {
          key: 'rewards',
          label: 'Rewards',
          items: [
            { key: 'milestones', label: 'Milestones', href: `/milestones/${scholarKey}` },
            { key: 'travel', label: 'Travel', href: `/vacation/${scholarKey}` },
          ],
        },
      ];

  return groups.filter(Boolean).map((g) => {
    const items = g.items?.map((t) => ({ ...t, active: t.key === active }));
    const hit = g.key === active || items?.some((t) => t.active);
    // A group's own href is its first page, so the bar link lands somewhere.
    return { ...g, items, href: g.href || items[0].href, active: hit };
  });
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
  actions,
  children,
}) {
  const { available: updateAvailable, checkForUpdate } = useAppUpdate();
  // A mentor viewing this scholar's own route (allowMentor on the auth gate)
  // otherwise sits inside chrome that is visually identical to actually
  // being signed in as her — same bar, same brand link, same name up top.
  // isMentor drives a "Back to Navigator" way out plus a visible badge.
  const isMentor = identityRole === 'Mentor';

  const defaultActions =
    !isMentor && active !== 'finances' ? (
      <Link className="ds-btn ds-btn--gold" href={`/entry?scholar=${scholarKey}`}>
        + Log expense
      </Link>
    ) : null;

  return (
    <div className="sp-shell ds-shell">
      <TopBar
        brand={{
          href: isMentor ? '/navigator' : `/home/${scholarKey}`,
          label: 'NextGen Scholars',
        }}
        groups={scholarNavGroups(scholarKey, active, isMentor)}
        actions={actions === undefined ? defaultActions : actions}
        account={{
          // Signed-in identity, not the page's subject. Showing the
          // scholar's name over the word "Mentor" read as "you are Claire,
          // a mentor" — the exact confusion this whole flow is meant to
          // dispel. A mentor sees their own role as the name and whose
          // page they're on underneath.
          initial: isMentor ? 'M' : name?.[0],
          name: isMentor ? 'Mentor' : name,
          role: isMentor ? `Viewing ${name}` : identityRole,
          links: [
            {
              key: 'update',
              label: updateAvailable ? 'Update ready — tap to reload' : 'Check for app update',
              onClick: checkForUpdate,
            },
            { key: 'site', label: 'Public site', href: '/' },
          ],
          signOut: (
            <SignOutButton className="ds-signout" onSignOut={onSignOut}>
              <IcnSignOut size={14} /> Sign out
            </SignOutButton>
          ),
        }}
      />
      <div className="ds-main">
        {title != null && (
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
          </header>
        )}
        <main className="ds-content">{children}</main>
      </div>
    </div>
  );
}
