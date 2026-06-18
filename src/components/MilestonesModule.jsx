import React, { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { MentorExpenseDrawer } from './MentorExpenseDrawer.jsx';
import { MILESTONE_CATS } from '../constants.js';

// Milestone states mirror the travels table: done (unlocked), booked (confirmed,
// upcoming), planned (intended). Anything that isn't 'done' is treated as upcoming.
const MS_STATES = {
  done:    { label: 'Unlocked', cls: 'done'    },
  booked:  { label: 'Booked',   cls: 'booked'  },
  planned: { label: 'Planned',  cls: 'planned' },
};

const NAME_EMOJI = [
  [/phone|smartphone|mobile/i, '📱'], [/laptop|computer|pc/i, '💻'],
  [/tablet|ipad/i, '📲'], [/bike|bicycle/i, '🚲'], [/motor|scooter/i, '🏍'],
  [/watch/i, '⌚'], [/camera/i, '📷'], [/desk|chair|furniture/i, '🪑'],
  [/internet|wifi|router/i, '📶'], [/printer/i, '🖨'], [/medical|equipment/i, '🩺'],
];

function nameEmoji(name) {
  if (!name) return '🎯';
  const hit = NAME_EMOJI.find(([re]) => re.test(name));
  return hit ? hit[1] : '🎯';
}

function fmtPhp(n) {
  if (!n) return null;
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function ScholarMilestones({ sk, s }) {
  // Bump after an expense write so the next drawer open re-reads fresh totals.
  const [, setTick] = useState(0);
  const milestones = s.milestones || [];
  const unlocked   = milestones.filter(m => m.state === 'done').length;
  const next       = milestones.find(m => m.state !== 'done') || null;
  const invested   = milestones.reduce((sum, m) => sum + (Number(m.amountPhp) || 0), 0);

  return (
    <div className="tm-scholar">
      <div className="tm-scholar-head">
        <span className="tm-scholar-name">{s.firstName}</span>
        <span className="tm-scholar-track">{s.track}</span>
        {next
          ? <span className="tm-next-dest">Next · {nameEmoji(next.name)} {next.name}</span>
          : <span className="tm-next-dest">All milestones unlocked</span>}
      </div>

      {milestones.length === 0 ? (
        <div className="tm-empty">No milestones recorded yet.</div>
      ) : (
        <>
          <div className="tm-stat-row">
            <span className="tm-stat"><b>{unlocked}</b> unlocked</span>
            <span className="tm-stat"><b>{milestones.length}</b> total</span>
            {invested > 0 && <span className="tm-stat"><b>{fmtPhp(invested)}</b> invested</span>}
          </div>

          <div className="tm-timeline">
            {milestones.map((m, i) => {
              const meta   = MS_STATES[m.state] || MS_STATES.planned;
              const isLast = i === milestones.length - 1;
              const amt    = fmtPhp(Number(m.amountPhp) || 0);
              return (
                <div key={i} className={`tm-stop tm-${meta.cls}`}>
                  <div className="tm-track-col">
                    <div className="tm-badge">
                      {m.state === 'done' ? '✓' : nameEmoji(m.name)}
                    </div>
                    {!isLast && <div className="tm-connector" />}
                  </div>
                  <div className="tm-stop-body">
                    <span className="tm-dest">{m.name}</span>
                    <span className="tm-stop-sub">{m.sem || m.when}{amt ? ` · ${amt}` : ''}</span>
                    {m.state === 'done' && m.sem && (
                      <MentorExpenseDrawer
                        scholarKey={sk}
                        sem={m.sem}
                        bucket="milestone"
                        cats={MILESTONE_CATS}
                        onAdded={() => setTick(n => n + 1)}
                      />
                    )}
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

export function MilestonesModule({ id }) {
  const { D, scholarKeys } = useData();
  const keys = scholarKeys.filter(sk => (D.scholars[sk]?.milestones || []).length > 0);

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Milestones Tracker 🎯
        <span className="eyebrow-rule" />
      </div>
      <div className="section-head">
        <h2 className="section-title">Rewards Unlocked</h2>
        <span className="section-note">
          Devices &amp; infrastructure unlocked as academic targets are hit.
        </span>
      </div>
      <div className="tm-grid">
        {keys.length === 0
          ? <div className="tm-empty">No milestones recorded yet.</div>
          : keys.map(sk => (
              <ScholarMilestones key={sk} sk={sk} s={D.scholars[sk]} />
            ))}
      </div>
    </section>
  );
}
