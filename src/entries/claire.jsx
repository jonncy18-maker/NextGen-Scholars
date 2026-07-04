import React from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { useScholarProfile } from '../hooks/useScholarProfile.js';
import { buildAcademicsHistory } from '../utils.js';

const STATIC = NGS_DATA.scholars.claire.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.claire;

// `s` is the curated payload from GET /api/public/profile/claire — already
// aggregated server-side (see that route for why raw expenses never reach
// the client).
const EMPTY_TOTALS = { total: 0, college: 0, milestone: 0, life: 0, travel: 0, exam: 0, professional: 0, admin: 0 };

function mergeSheetData(base, s) {
  if (!s) return base;
  const academics = s.academics || [];
  const latestGpa = [...academics].reverse().find(a => a.gpa != null);
  // s is the live /api/public/profile/:key payload once fetched, but the
  // initial render calls this with the static NGS_DATA scholar object
  // instead (no investmentTotals field yet) — default to zero, not a crash.
  const investmentTotals = s.investmentTotals || EMPTY_TOTALS;
  const progressPct = s.allocated > 0 ? Math.min(1, investmentTotals.total / s.allocated) : base.support.total.progress;
  const nextTravel = (s.travels || []).find(t => t.state !== 'done') || null;
  const nextMil = (s.milestones || []).find(m => m.state !== 'done') || null;

  return {
    ...base,
    currentSem: s.currentSem || STATIC_SCHOLAR.currentSem || null,
    gpaFloor:   s.gpaFloor ?? base.academics?.current?.floor ?? 81,
    investmentTotals,
    englishHours: s.englishHours ?? null,
    nextTravelAward: nextTravel ? { dest: nextTravel.dest, sem: nextTravel.sem } : null,
    nextMilestoneAward: nextMil ? { name: nextMil.name, sem: nextMil.sem } : null,
    latestGpa: latestGpa ? { value: latestGpa.gpa, sem: latestGpa.sem, floor: s.gpaFloor ?? base.academics?.current?.floor ?? 81 } : null,
    support: {
      ...base.support,
      total: {
        ...base.support.total,
        rawPhp: investmentTotals.total,
        progress: progressPct,
        detail: 'Across university, travel program, and milestone rewards',
      },
      categories: [
        { icon: 'cap',    name: 'University',        amountPhp: investmentTotals.college,   detail: base.support.categories[0]?.detail || '' },
        { icon: 'us',     name: 'Travel Program',    amountPhp: investmentTotals.travel,     detail: base.support.categories[1]?.detail || '' },
        { icon: 'trophy', name: 'Milestone Rewards', amountPhp: investmentTotals.milestone,  detail: base.support.categories[2]?.detail || '' },
      ],
    },
    academics: {
      ...base.academics,
      ...(latestGpa ? {
        current: {
          label: `${latestGpa.sem} — Latest GPA`,
          value: latestGpa.gpa,
          floor: s.gpaFloor ?? base.academics.current.floor,
        },
      } : {}),
      ...(academics.length ? { history: buildAcademicsHistory(academics) } : {}),
    },
    milestones: s.milestones?.length
      ? s.milestones.map((m, i) => {
          const stat = base.milestones[i] || {};
          return { ...stat, state: m.state === 'done' ? 'done' : 'future' };
        })
      : base.milestones,
    travels: s.travels?.length
      ? s.travels.map((t, i) => {
          const stat = (base.travels || [])[i] || {};
          return { ...stat, state: t.state };
        })
      : base.travels,
  };
}

export function ClairePage() {
  const { profileData, isMobile } = useScholarProfile('claire', STATIC, STATIC_SCHOLAR, mergeSheetData);
  return <ScholarProfile data={profileData} isMobile={isMobile} englishHours={profileData.englishHours ?? null} relatedProfiles={[{ name: 'April', href: '/april' }]} />;
}
