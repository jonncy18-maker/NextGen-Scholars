import React from 'react';
import Link from 'next/link';
import { useData } from '../context/DataContext.jsx';

// Mentor's way in to each scholar's OWN living budget (/budget/:scholar).
//
// ── Why this is a link list and not an embedded editor ──────────────────────
// LivingBudget renders its own ScholarShell (sidebar, header, sign-out), so
// dropping it in here would nest one full page shell inside another. The
// screen already admits a mentor for any scholar — ScholarAuthGate's
// `allowMentor`, with every fetch scoped by ?scholar= — so the mentor gets the
// identical summary and builder simply by following these links. Nothing is
// reimplemented here, which is also why there is no second copy of the budget
// UI to keep in step.
//
// ── Naming ─────────────────────────────────────────────────────────────────
// "Living Budget", never "Budget". The Navigator's existing Budget section is
// the PROGRAM budget (the `budgets` table — what the scholarship plans to
// spend per semester). These are two different ledgers that must never be
// summed; see db/living_budget.sql. Keeping the names distinct is the cheapest
// guard against someone later assuming they are the same thing.

// TESDA-track scholars are on a one-off program with no monthly allowance, so
// there is no living budget to open for them. Mirrors EnglishSection.jsx,
// which excludes the same track for the same kind of reason.
const NO_ALLOWANCE_TRACKS = new Set(['TESDA']);

export function LivingBudgetSection({ id }) {
  const { D, scholarKeys } = useData();

  const eligible = scholarKeys.filter((k) => !NO_ALLOWANCE_TRACKS.has(D.scholars[k]?.track));

  return (
    <div className="lbs-module" id={id}>
      <p className="lbs-intro">
        Each scholar plans her own allowance here — her categories, her amounts. You can view and
        edit exactly what she sees. This is <strong>her</strong> money, separate from the program
        budget: the two are never added together.
      </p>

      <div className="lbs-grid">
        {eligible.map((k) => {
          const s = D.scholars[k] || {};
          return (
            <Link key={k} href={`/budget/${k}`} className="lbs-card">
              <span className="lbs-card-name">{s.firstName || k}</span>
              <span className="lbs-card-meta">{s.program || s.track || '—'}</span>
              <span className="lbs-card-cta">Open living budget →</span>
            </Link>
          );
        })}
      </div>

      {eligible.length === 0 && (
        <div className="lbs-empty">No scholars on an allowance-based track.</div>
      )}
    </div>
  );
}
