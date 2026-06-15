import React from 'react';
import { useData } from '../context/DataContext.jsx';

// Ordered list of semester codes — used to compare progress positions.
const SEM_ORDER = [
  'TG11S1', 'TG11S2', 'TG12S1', 'TG12S2',
  'Y1S1',   'Y1S2',   'Y2S1',   'Y2S2',
  'Y3S1',   'Y3S2',   'Y4S1',   'Y4S2',   'PostY1',
];

// Seven fixed NGN travel milestones in chronological order.
// doneGte: the first semester code at which this milestone is considered past.
const MILESTONES = [
  {
    key: 'cebu-entry',
    dest: 'Cebu',
    label: 'Welcome Excursion',
    sub: 'Scholarship Entry · Grade 10',
    emoji: '🏝',
    doneGte: 'TG11S1',
  },
  {
    key: 'cebu-g11',
    dest: 'Cebu',
    label: 'Year One Complete',
    sub: 'End of Grade 11',
    emoji: '🏝',
    doneGte: 'TG12S1',
  },
  {
    key: 'boracay',
    dest: 'Boracay',
    label: 'High School Graduation',
    sub: 'End of Grade 12',
    emoji: '🌊',
    doneGte: 'Y1S1',
  },
  {
    key: 'bohol',
    dest: 'Bohol',
    label: 'Freshman Year Complete',
    sub: 'End of Year 1',
    emoji: '🏖',
    doneGte: 'Y2S1',
  },
  {
    key: 'hong-kong',
    dest: 'Hong Kong',
    label: 'Sophomore Year Complete',
    sub: 'End of Year 2',
    emoji: '🌆',
    doneGte: 'Y3S1',
  },
  {
    key: 'asian-cruise',
    dest: 'Asian Cruise',
    label: 'Junior Year Complete',
    sub: 'End of Year 3',
    emoji: '🚢',
    doneGte: 'Y4S1',
  },
  {
    key: 'us',
    dest: 'United States',
    label: 'College Graduate',
    sub: '3 months · Post-graduation',
    emoji: '✈',
    doneGte: 'PostY1',
  },
];

function semIdx(sem) {
  return sem ? SEM_ORDER.indexOf(sem) : -1;
}

function latestGpa(s) {
  const rows = (s.academics || []).filter(a => a.gpa != null && a.status !== 'excluded');
  return rows.length ? rows[rows.length - 1].gpa : null;
}

function gpaClass(gpa, floor) {
  if (gpa == null || floor == null) return 'tm-gpa-amber';
  if (gpa >= floor + 2) return 'tm-gpa-green';
  if (gpa >= floor)     return 'tm-gpa-amber';
  return 'tm-gpa-red';
}

function buildStatuses(s) {
  const curIdx  = semIdx(s.currentSem);
  const travels = s.travels || [];
  let currentSet = false;

  return MILESTONES.map(m => {
    // Explicit "done" record in the travels table beats everything.
    const tMatch = travels.find(
      t => t.dest?.toLowerCase() === m.dest.toLowerCase() && t.state === 'done'
    );
    if (tMatch) return { ...m, status: 'done' };

    // Semester-based completion: student is at or past the unlock point.
    const doneIdx = semIdx(m.doneGte);
    if (doneIdx >= 0 && curIdx >= doneIdx) return { ...m, status: 'done' };

    // First not-yet-done milestone = the one they are currently earning.
    if (!currentSet) {
      currentSet = true;
      return { ...m, status: 'current' };
    }
    return { ...m, status: 'future' };
  });
}

function ScholarTravel({ sk, s }) {
  const gpa      = latestGpa(s);
  const gc       = gpaClass(gpa, s.gpaFloor);
  const statuses = buildStatuses(s);
  const nextStop = statuses.find(m => m.status === 'current');

  return (
    <div className="tm-scholar">
      <div className="tm-scholar-head">
        <span className="tm-scholar-name">{s.firstName}</span>
        <span className="tm-scholar-track">{s.track}</span>
        {nextStop && (
          <span className="tm-next-dest">
            Next · {nextStop.emoji} {nextStop.dest}
          </span>
        )}
      </div>

      <div className="tm-timeline">
        {statuses.map((m, i) => {
          const isLast = i === statuses.length - 1;
          const cls = [
            'tm-stop',
            `tm-${m.status}`,
            m.status === 'current' ? gc : '',
          ].filter(Boolean).join(' ');

          const pillLabel =
            m.status === 'done'    ? 'Complete'
            : m.status === 'current' && gpa != null ? `${gpa.toFixed(1)}%`
            : m.status === 'current' ? 'Active'
            : 'Upcoming';

          return (
            <div key={m.key} className={cls}>
              <div className="tm-track-col">
                <div className="tm-badge">
                  {m.status === 'done' ? '✓' : m.emoji}
                </div>
                {!isLast && <div className="tm-connector" />}
              </div>
              <div className="tm-stop-body">
                <span className="tm-dest">{m.dest}</span>
                <span className="tm-stop-label">{m.label}</span>
                <span className="tm-stop-sub">{m.sub}</span>
              </div>
              <div className="tm-pill-wrap">
                <span className={`tm-pill tm-pill-${m.status}`}>{pillLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TravelModule({ id, collapsed, onToggle }) {
  const { D, scholarKeys } = useData();
  const ngnKeys = scholarKeys.filter(sk => D.scholars[sk]?.track === 'NGN');

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Travel Milestones ✈
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
              Destination milestones · NGN scholars · GPA-gated progression.
            </span>
          </div>
          <div className="tm-grid">
            {ngnKeys.map(sk => (
              <ScholarTravel key={sk} sk={sk} s={D.scholars[sk]} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
