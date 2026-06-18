import React from 'react';
import { useData } from '../context/DataContext.jsx';

// Trip states stored in the travels table: done (taken), booked (confirmed,
// upcoming), planned (intended). Each maps to a badge + pill label.
const TRIP_STATES = {
  done:    { label: 'Completed', cls: 'done'    },
  booked:  { label: 'Booked',    cls: 'booked'  },
  planned: { label: 'Planned',   cls: 'planned' },
};

const DEST_EMOJI = [
  [/cebu/i, '🏝'], [/boracay/i, '🌊'], [/bohol/i, '🏖'],
  [/hong ?kong/i, '🌆'], [/cruise/i, '🚢'], [/taiwan/i, '🚢'],
  [/manila|visa/i, '🛂'], [/u\.?s\.?|united states|america|immersion/i, '✈'],
  [/japan|tokyo/i, '🗼'], [/korea|seoul/i, '🏙'], [/singapore/i, '🌃'],
];

function destEmoji(dest) {
  if (!dest) return '📍';
  const hit = DEST_EMOJI.find(([re]) => re.test(dest));
  return hit ? hit[1] : '📍';
}

function fmtPhp(n) {
  if (!n) return null;
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function ScholarTravel({ s }) {
  const travels  = s.travels || [];
  const taken    = travels.filter(t => t.state === 'done').length;
  const nextTrip = travels.find(t => t.state !== 'done') || null;
  const invested = travels.reduce((sum, t) => sum + (Number(t.amountPhp) || 0), 0);

  return (
    <div className="tm-scholar">
      <div className="tm-scholar-head">
        <span className="tm-scholar-name">{s.firstName}</span>
        <span className="tm-scholar-track">{s.track}</span>
        {nextTrip
          ? <span className="tm-next-dest">Next · {destEmoji(nextTrip.dest)} {nextTrip.dest}</span>
          : <span className="tm-next-dest">All trips complete</span>}
      </div>

      {travels.length === 0 ? (
        <div className="tm-empty">No reward trips recorded yet.</div>
      ) : (
        <>
          <div className="tm-stat-row">
            <span className="tm-stat"><b>{taken}</b> taken</span>
            <span className="tm-stat"><b>{travels.length}</b> planned</span>
            {invested > 0 && <span className="tm-stat"><b>{fmtPhp(invested)}</b> invested</span>}
          </div>

          <div className="tm-timeline">
            {travels.map((t, i) => {
              const meta   = TRIP_STATES[t.state] || TRIP_STATES.planned;
              const isLast = i === travels.length - 1;
              const amt    = fmtPhp(Number(t.amountPhp) || 0);
              return (
                <div key={i} className={`tm-stop tm-${meta.cls}`}>
                  <div className="tm-track-col">
                    <div className="tm-badge">
                      {t.state === 'done' ? '✓' : destEmoji(t.dest)}
                    </div>
                    {!isLast && <div className="tm-connector" />}
                  </div>
                  <div className="tm-stop-body">
                    <span className="tm-dest">{t.dest}</span>
                    <span className="tm-stop-sub">{t.sem || t.when}{amt ? ` · ${amt}` : ''}</span>
                  </div>
                  <div className="tm-pill-wrap">
                    <span className={`tm-pill tm-pill-${meta.cls}`}>{meta.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function TravelModule({ id, collapsed, onToggle }) {
  const { D, scholarKeys } = useData();
  const ngnKeys = scholarKeys.filter(sk => D.scholars[sk]?.track === 'NGN');

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Vacation Tracker ✈
        <span className="eyebrow-rule" />
        <button
          className="section-collapse-btn"
          onClick={onToggle}
          title={collapsed ? 'Expand section' : 'Collapse section'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">Journey Rewards</h2>
            <span className="section-note">
              Reward trips · NGN scholars · taken, booked, and planned.
            </span>
          </div>
          <div className="tm-grid">
            {ngnKeys.map(sk => (
              <ScholarTravel key={sk} s={D.scholars[sk]} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
