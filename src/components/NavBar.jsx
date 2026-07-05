'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavBar({ sheetsStatus, onRefresh, aiDrawerOpen, onAiDrawerToggle, onSignOut }) {
  const pathname = usePathname();
  const isHome = pathname === '/navigator' || pathname === '/navigator/';
  const isExpenses = pathname === '/navigator/expenses';
  const isBudget = pathname === '/navigator/budget';

  return (
    <header className="nav nav--slim">
      <div className="nav-inner">
        <Link className="nav-brand" href="/navigator">
          <span className="ngs-mark ngs-mark-sm"><span>N</span><span>G</span><span>S</span></span>
          <span className="nav-name">Pathway Navigator</span>
        </Link>
        <div className="nav-right">
          {isExpenses && (
            <Link className="nav-budget-btn" href="/navigator/budget">Budget</Link>
          )}
          <button
            className={`nav-ai-btn${aiDrawerOpen ? ' is-active' : ''}`}
            onClick={onAiDrawerToggle}
            title="Open Navigator AI"
          >
            Ask AI
          </button>
          <button
            className={`nav-refresh${sheetsStatus === 'loading' ? ' is-loading' : ''}`}
            onClick={onRefresh}
            title="Reload data from Neon"
          >
            <span className="refresh-icon">↻</span><span className="refresh-label"> Refresh</span>
          </button>
          {isHome
            ? <Link className="nav-back" href="/">← Go home</Link>
            : isBudget
              ? <Link className="nav-back" href="/navigator/expenses">← Expense</Link>
              : <Link className="nav-back" href="/navigator">← Dashboard</Link>
          }
          <button className="nav-signout" onClick={onSignOut} title="Sign out">Sign out</button>
        </div>
      </div>
    </header>
  );
}
