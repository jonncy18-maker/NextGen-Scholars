import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/profile.css';
import { NGS_DATA } from '../scholars-data.js';
import { ScholarProfile } from './components/Profile/ScholarProfile.jsx';
import { loadFromSheets } from './sheets-loader.js';
import { scholarTotals } from './utils.js';

const STATIC = NGS_DATA.scholars.april.publicProfile;

function mergeSheetData(base, s) {
  if (!s) return base;
  const tots = scholarTotals(s);

  return {
    ...base,
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

function App() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 960px)').matches
  );
  const [profileData, setProfileData] = useState(STATIC);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadFromSheets()
      .then(data => {
        if (data.scholars?.april) {
          setProfileData(mergeSheetData(STATIC, data.scholars.april));
        }
      })
      .catch(() => {});
  }, []);

  return <ScholarProfile data={profileData} isMobile={!isDesktop} relatedProfiles={[{ name: 'Claire', href: 'claire.html' }]}/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
