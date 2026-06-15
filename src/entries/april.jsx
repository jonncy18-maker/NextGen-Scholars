import React, { useState, useEffect } from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { useScholarProfile } from '../hooks/useScholarProfile.js';
import { scholarTotals } from '../utils.js';
import { supabase } from '../lib/supabase.js';

const STATIC = NGS_DATA.scholars.april.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.april;

function mergeSheetData(base, s) {
  if (!s) return base;
  const tots = scholarTotals(s);
  const academics = [...(s.academics || [])];
  const latestGpa = [...academics].reverse().find(a => a.gpa != null);
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
    travels: s.travels?.length
      ? s.travels.map((t, i) => {
          const stat = base.travels[i] || {};
          return { ...stat, state: t.state };
        })
      : base.travels,
  };
}

export function AprilPage() {
  const { profileData, isMobile } = useScholarProfile('april', STATIC, STATIC_SCHOLAR, mergeSheetData);
  const [englishHours, setEnglishHours] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('english_periods').select('*').eq('scholar', 'april').lte('start_date', today).gte('end_date', today)
      .then(({ data: periods }) => {
        if (!periods?.length) return;
        const p = periods[0];
        return supabase.from('english_sessions').select('duration_minutes').eq('scholar', 'april').gte('date', p.start_date).lte('date', p.end_date)
          .then(({ data: sessions }) => {
            const mins = (sessions || []).reduce((s, r) => s + (r.duration_minutes || 0), 0);
            setEnglishHours({ hours: Math.round((mins / 60) * 10) / 10, goal: Number(p.hour_goal) });
          });
      })
      .catch(() => {});
  }, []);

  return <ScholarProfile data={profileData} isMobile={isMobile} englishHours={englishHours} relatedProfiles={[{ name: 'Claire', href: '/claire' }]} />;
}
