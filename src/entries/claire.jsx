import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/profile.css';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { loadFromSupabase } from '../supabase-loader.js';
import { scholarTotals, buildAcademicsHistory } from '../utils.js';

const STATIC = NGS_DATA.scholars.claire.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.claire;

function mergeSheetData(base, s) {
  if (!s) return base;
  const tots = scholarTotals(s);
  const academics = [...(s.academics || [])];
  const latestGpa = [...academics].reverse().find(a => a.gpa != null);
  const allocated = Object.values(s.budgets || {}).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
  const progressPct = allocated > 0 ? Math.min(1, tots.total / allocated) : base.support.total.progress;

  return {
    ...base,
    support: {
      ...base.support,
      total: {
        ...base.support.total,
        rawPhp: tots.total,
        progress: progressPct,
        detail: 'Across university, travel program, and milestone rewards',
      },
      categories: [
        { icon: 'cap',    name: 'University',        amountPhp: tots.university, detail: base.support.categories[0]?.detail || '' },
        { icon: 'us',     name: 'Travel Program',    amountPhp: tots.travel,     detail: base.support.categories[1]?.detail || '' },
        { icon: 'trophy', name: 'Milestone Rewards', amountPhp: tots.milestones, detail: base.support.categories[2]?.detail || '' },
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

function App() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 960px)').matches
  );
  const [profileData, setProfileData] = useState(() => mergeSheetData(STATIC, STATIC_SCHOLAR));

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadFromSupabase()
      .then(data => {
        if (data.scholars?.claire) {
          setProfileData(mergeSheetData(STATIC, data.scholars.claire));
        }
      })
      .catch(() => { setProfileData(mergeSheetData(STATIC, STATIC_SCHOLAR)); });
  }, []);

  return <ScholarProfile data={profileData} isMobile={!isDesktop} relatedProfiles={[{ name: 'April', href: 'april.html' }]}/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
