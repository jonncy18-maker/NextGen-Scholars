import React from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { useScholarProfile } from '../hooks/useScholarProfile.js';

const STATIC = NGS_DATA.scholars.janndilyne.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.janndilyne;

const EMPTY_TOTALS = { total: 0, college: 0, milestone: 0, life: 0, travel: 0, exam: 0, professional: 0, admin: 0 };

// TESDA track — no English hours and no travel/vacation program, so this merge
// deliberately omits the travels handling that the NGN scholar pages
// (claire.jsx / april.jsx) carry. `s` is the curated payload from
// GET /api/public/profile/janndilyne — already aggregated server-side.
function mergeSheetData(base, s) {
  if (!s) return base;
  const academics = s.academics || [];
  const latestGpa = [...academics].reverse().find(a => a.gpa != null);
  // The initial render calls this with the static NGS_DATA scholar object
  // instead of a live payload (no investmentTotals field yet) — default to
  // zero, not a crash.
  const investmentTotals = s.investmentTotals || EMPTY_TOTALS;
  const nextMil = (s.milestones || []).find(m => m.state !== 'done') || null;
  const floor = s.gpaFloor ?? base.academics?.current?.floor ?? null;

  return {
    ...base,
    currentSem: s.currentSem || STATIC_SCHOLAR.currentSem || null,
    gpaFloor:   floor,
    investmentTotals,
    nextMilestoneAward: nextMil ? { name: nextMil.name, sem: nextMil.sem } : null,
    latestGpa: latestGpa ? { value: latestGpa.gpa, sem: latestGpa.sem, floor } : null,
    support: {
      ...base.support,
      total: {
        ...base.support.total,
        rawPhp: investmentTotals.total > 0 ? investmentTotals.total : base.support.total.rawPhp,
        detail: base.support.total.detail,
      },
    },
    milestones: s.milestones?.length
      ? s.milestones.map((m, i) => {
          const stat = base.milestones[i] || {};
          return { ...stat, state: m.state === 'done' ? 'done' : 'future' };
        })
      : base.milestones,
  };
}

export function JanndilynePage() {
  const { profileData, isMobile } = useScholarProfile('janndilyne', STATIC, STATIC_SCHOLAR, mergeSheetData);

  // englishHours={null} hides the English Hours header card; the publicProfile has
  // no `english`/`travels` keys, so those sections are omitted entirely. No
  // relatedProfiles — this is an unadvertised one-off, so it does not cross-link.
  return <ScholarProfile data={profileData} isMobile={isMobile} englishHours={null} relatedProfiles={[]} />;
}
