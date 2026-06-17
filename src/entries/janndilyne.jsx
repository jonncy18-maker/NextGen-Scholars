import React from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { useScholarProfile } from '../hooks/useScholarProfile.js';
import { scholarTotals } from '../utils.js';

const STATIC = NGS_DATA.scholars.janndilyne.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.janndilyne;

// TESDA track — no English hours and no travel/vacation program, so this merge
// deliberately omits the english-hours fetch and the travels handling that the
// NGN scholar pages (claire.jsx / april.jsx) carry.
function mergeSheetData(base, s) {
  if (!s) return base;
  const tots = scholarTotals(s);
  const academics = [...(s.academics || [])];
  const latestGpa = [...academics].reverse().find(a => a.gpa != null);
  const nextMil = (s.milestones || []).find(m => m.state !== 'done') || null;
  const floor = s.gpaFloor ?? base.academics?.current?.floor ?? null;

  return {
    ...base,
    currentSem: s.currentSem || STATIC_SCHOLAR.currentSem || null,
    gpaFloor:   floor,
    investmentTotals: {
      total: tots.total,
      college: tots.college,
      life: tots.life,
      milestone: tots.milestone,
      travel: tots.travel,
    },
    nextMilestoneAward: nextMil ? { name: nextMil.name, sem: nextMil.sem } : null,
    latestGpa: latestGpa ? { value: latestGpa.gpa, sem: latestGpa.sem, floor } : null,
    support: {
      ...base.support,
      total: {
        ...base.support.total,
        rawPhp: tots.total > 0 ? tots.total : base.support.total.rawPhp,
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
