import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.jsx';
import { supabase } from '../lib/supabase.js';

const OET_TARGET_HOURS = 200;

function OetProgress({ sk }) {
  const [stat, setStat] = useState(null);

  useEffect(() => {
    supabase
      .from('english_sessions')
      .select('duration_minutes, date')
      .eq('scholar', sk)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setStat({ totalHours: 0, paceHrsPerWeek: 0 });
          return;
        }
        const totalMins = data.reduce((s, r) => s + (r.duration_minutes || 0), 0);
        const cutoff    = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
        const recent    = data.filter(r => r.date && new Date(r.date) >= cutoff);
        const recentMins = recent.reduce((s, r) => s + (r.duration_minutes || 0), 0);
        setStat({
          totalHours:      totalMins / 60,
          paceHrsPerWeek:  recentMins / 60 / 4,
        });
      });
  }, [sk]);

  if (stat === null) return null;

  const { totalHours, paceHrsPerWeek } = stat;
  const remaining  = Math.max(0, OET_TARGET_HOURS - totalHours);
  const pct        = Math.min(100, Math.round((totalHours / OET_TARGET_HOURS) * 100));
  const onTrack    = paceHrsPerWeek > 0;
  const weeksLeft  = paceHrsPerWeek > 0 ? Math.ceil(remaining / paceHrsPerWeek) : null;
  const trackLabel = !onTrack ? 'no recent sessions'
                   : weeksLeft !== null ? `~${weeksLeft}w to target`
                   : 'on track';

  return (
    <div className="oet-progress">
      <div className="oet-progress-bar-wrap">
        <div className="oet-progress-bar" style={{ width: pct + '%' }} />
      </div>
      <div className="oet-progress-stat">
        <span className="oet-hrs">{totalHours.toFixed(1)} hrs</span>
        <span className="oet-sep"> / {OET_TARGET_HOURS} hrs target</span>
        <span className={`oet-track oet-track-${onTrack ? 'on' : 'off'}`}> · {trackLabel}</span>
      </div>
    </div>
  );
}

function EnglishCard({ sk }) {
  const { D } = useData();
  const s = D.scholars[sk];
  const eng = s?.english;
  if (!eng) return null;
  return (
    <div className="eng-card">
      <div className="eng-scholar">{eng.scholar}</div>
      <div className="eng-stage">{eng.stage}</div>
      <OetProgress sk={sk} />
      <p className="eng-desc">{eng.desc}</p>
      <div className="eng-obs">
        {eng.observations.map((ob, i) => (
          <div key={i} className="eng-ob">
            <span className={`eng-dot ${ob.type}`} />
            {ob.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EnglishSection({ id, collapsed, onToggle }) {
  const { D, scholarKeys } = useData();
  const withEnglish = scholarKeys.filter(k => D.scholars[k]?.english);
  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">05</span> English Development Pulse
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head"><h2 className="section-title">From Cebu to the world</h2></div>
          <div className="eng-grid">
            {withEnglish.map(k => <EnglishCard key={k} sk={k} />)}
          </div>
        </>
      )}
    </section>
  );
}
