import React, { useState, useEffect } from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { useScholarProfile } from '../hooks/useScholarProfile.js';
import { scholarTotals, buildAcademicsHistory } from '../utils.js';
import { supabase } from '../lib/supabase.js';

const STATIC = NGS_DATA.scholars.claire.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.claire;

function mergeSheetData(base, s) {
  if (!s) return base;
  const tots = scholarTotals(s);
  const academics = [...(s.academics || [])];
  const latestGpa = [...academics].reverse().find(a => a.gpa != null);
  const allocated = Object.values(s.budgets || {}).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
  const progressPct = allocated > 0 ? Math.min(1, tots.total / allocated) : base.support.total.progress;
  const nextTravel = (s.travels || []).find(t => t.state !== 'done') || null;
  const nextMil = (s.milestones || []).find(m => m.state !== 'done') || null;

  return {
    ...base,
    currentSem: s.currentSem || STATIC_SCHOLAR.currentSem || null,
    gpaFloor:   s.gpaFloor ?? base.academics?.current?.floor ?? 81,
    investmentTotals: {
      total: tots.total,
      college: tots.college,
      life: tots.life,
      milestone: tots.milestone,
      travel: tots.travel,
    },
    nextTravelAward: nextTravel ? { dest: nextTravel.dest, sem: nextTravel.sem } : null,
    nextMilestoneAward: nextMil ? { name: nextMil.name, sem: nextMil.sem } : null,
    latestGpa: latestGpa ? { value: latestGpa.gpa, sem: latestGpa.sem, floor: s.gpaFloor ?? base.academics?.current?.floor ?? 81 } : null,
    support: {
      ...base.support,
      total: {
        ...base.support.total,
        rawPhp: tots.total,
        progress: progressPct,
        detail: 'Across university, travel program, and milestone rewards',
      },
      categories: [
        { icon: 'cap',    name: 'University',        amountPhp: tots.college,    detail: base.support.categories[0]?.detail || '' },
        { icon: 'us',     name: 'Travel Program',    amountPhp: tots.travel,     detail: base.support.categories[1]?.detail || '' },
        { icon: 'trophy', name: 'Milestone Rewards', amountPhp: tots.milestone,  detail: base.support.categories[2]?.detail || '' },
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
          const stat = base.travels[i] || {};
          return { ...stat, state: t.state };
        })
      : base.travels,
  };
}

export function ClairePage() {
  const { profileData, isMobile } = useScholarProfile('claire', STATIC, STATIC_SCHOLAR, mergeSheetData);
  const [englishHours, setEnglishHours] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('english_periods').select('*').eq('scholar', 'claire').lte('start_date', today).gte('end_date', today)
      .then(({ data: periods }) => {
        if (!periods?.length) return;
        const p = periods[0];
        return supabase.from('english_sessions').select('duration_minutes').eq('scholar', 'claire').gte('date', p.start_date).lte('date', p.end_date)
          .then(({ data: sessions }) => {
            const mins = (sessions || []).reduce((s, r) => s + (r.duration_minutes || 0), 0);
            setEnglishHours({ hours: Math.round((mins / 60) * 10) / 10, goal: Number(p.hour_goal) });
          });
      })
      .catch(() => {});
  }, []);

  return <ScholarProfile data={profileData} isMobile={isMobile} englishHours={englishHours} relatedProfiles={[{ name: 'April', href: '/april' }]} />;
}
