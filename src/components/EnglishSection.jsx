import React from 'react';
import { useData } from '../context/DataContext.jsx';

function EnglishCard({ sk }) {
  const { D } = useData();
  const s = D.scholars[sk];
  const eng = s?.english;
  if (!eng) return null;
  return (
    <div className="eng-card">
      <div className="eng-scholar">{eng.scholar}</div>
      <div className="eng-stage">{eng.stage}</div>
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
