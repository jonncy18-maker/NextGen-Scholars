import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NGSIcons } from './icons.jsx';
import { DEFAULT_RATE } from '../../fx.js';
import { useFxState } from '../../context/FxContext.jsx';
import { JourneyDropdown } from '../JourneyDropdown.jsx';
import { JOURNEY_STAGES } from '../../constants.js';
import { PublicAskWidget } from '../PublicAskWidget.jsx';

function fmtPhp(amountPhp, currency, rate) {
  if (amountPhp == null) return null;
  if (currency === 'USD') return '$' + Math.round(amountPhp / (rate || DEFAULT_RATE)).toLocaleString('en-US');
  return '₱' + Math.round(amountPhp).toLocaleString('en-US');
}

// ── root export ───────────────────────────────────────────────────────────────

export function ScholarProfile({ data, isMobile, relatedProfiles, englishHours }) {
  const fx = useFxState();

  return (
    <div className={`ngs-profile ${isMobile ? 'is-mobile' : 'is-desktop'}`}
         data-screen-label={`${data.firstName} — Profile`}>
      <TopNav data={data} fx={fx} isMobile={isMobile} />
      <PhotoHeader data={data} englishHours={englishHours}/>
      {data.quote && <PullQuote quote={data.quote}/>}
      {data.trialBanner && <TrialBanner text={data.trialBanner}/>}
      {data.trialProgress && <TrialProgressSection data={data.trialProgress}/>}
      {data.currentSemester && <SemesterSection data={data.currentSemester}/>}
      {data.academics && <AcademicSection data={data.academics}/>}
      {data.support && <SupportSection data={data.support} currency={fx.currency} fxRate={fx.fxRate} />}
      {data.milestones && <MilestonesSection items={data.milestones}/>}
      {data.travels && (
        <TravelsSection
          items={data.travels}
          currentSem={data.currentSem}
          gpaFloor={data.gpaFloor}
          latestGpa={data.latestGpa?.value}
        />
      )}
      {data.english && <EnglishSection data={data.english}/>}
      {data.pathway && <PathwaySection data={data.pathway}/>}
      <ProfileFooter data={data} relatedProfiles={relatedProfiles}/>
      <PublicAskWidget />
    </div>
  );
}

// ── top nav ───────────────────────────────────────────────────────────────────

function TopNav({ data, fx, isMobile }) {
  const [inputVal, setInputVal] = useState(String(fx.fxRate));
  const [open, setOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);

  useEffect(() => { setInputVal(fx.fxRate.toFixed(2)); }, [fx.fxRate]);

  function handleRateInput(e) {
    setInputVal(e.target.value);
    const n = parseFloat(e.target.value);
    if (!isNaN(n) && n > 0) fx.handleRateChange(n);
  }

  const fxWidget = (
    <div className="ngs-pnav-fx">
      <div className="ngs-pnav-curtoggle">
        {['PHP', 'USD'].map(cur => (
          <button
            key={cur}
            className={fx.currency === cur ? 'active' : ''}
            onClick={() => fx.setCurrency(cur)}
          >
            {cur === 'PHP' ? 'PHP ₱' : 'USD $'}
          </button>
        ))}
      </div>
      <div className="ngs-pnav-fxwidget">
        <span className="ngs-pnav-fxlabel">$1 = ₱</span>
        <div className="ngs-pnav-fxmode">
          <button className={fx.fxMode === 'market' ? 'active' : ''} onClick={() => fx.handleModeChange('market')}>
            {fx.fxStatus === 'loading' ? '⟳' : 'Market'}
          </button>
          <button className={fx.fxMode === 'manual' ? 'active' : ''} onClick={() => fx.handleModeChange('manual')}>
            Manual
          </button>
        </div>
        <input
          type="number"
          className={`ngs-pnav-fxinput${fx.fxMode === 'market' ? ' is-market' : ''}`}
          value={inputVal}
          disabled={fx.fxMode === 'market'}
          min="1" max="999" step="0.01"
          onChange={handleRateInput}
          title={fx.fxMode === 'market' ? 'Rate set by market — switch to Manual to edit' : 'PHP per 1 USD'}
        />
        {fx.fxStatus === 'error' && <span className="ngs-pnav-fxerr" title="Could not fetch market rate">!</span>}
      </div>
    </div>
  );

  return (
    <header className="ngs-pnav">
      <div className="ngs-pnav-inner">
        <Link to="/" className="ngs-pnav-brand">
          <div className="ngs-mark ngs-mark-sm">
            <span>N</span><span>G</span><span>S</span>
          </div>
          <span className="ngs-pnav-name">NextGen Scholars</span>
        </Link>
        {fxWidget}
        {isMobile ? (
          <button
            className="ngs-pnav-btn"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="ngs-pnav-mobile-menu"
          >
            <span></span><span></span>
          </button>
        ) : (
          <nav className="ngs-pnav-desktop">
            <a href="/#about">About</a>
            <a href="/#tracks">Tracks</a>
            <JourneyDropdown baseHref="/" />
            <a href="/#scholars">Scholars</a>
            <Link to="/navigator" className="ngs-pnav-mentor-link">Navigator</Link>
            <a href="/#apply" className="ngs-pnav-cta-link">Apply</a>
          </nav>
        )}
      </div>
      {isMobile && open && (
        <nav className="ngs-pnav-menu" id="ngs-pnav-mobile-menu" onClick={() => setOpen(false)}>
          <a href="/#about">About</a>
          <a href="/#tracks">Tracks</a>
          <button
            className={`ngs-pnav-journey-toggle${journeyOpen ? ' is-open' : ''}`}
            onClick={e => { e.stopPropagation(); setJourneyOpen(v => !v); }}
            aria-expanded={journeyOpen}
          >
            <span>Journey</span>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path
                d={journeyOpen ? 'M1 8l4.5-4.5L10 8' : 'M1 3l4.5 4.5L10 3'}
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </button>
          {journeyOpen && (
            <div className="ngs-pnav-journey-sub">
              {JOURNEY_STAGES.map((s, i) => (
                <a key={i} href={`/${s.href}`} className="ngs-pnav-journey-sub-item">
                  <span className="ngs-jdrop-num">0{i + 1}</span>
                  {s.label}
                </a>
              ))}
            </div>
          )}
          <a href="/#scholars">Scholars</a>
          <Link to="/navigator">Navigator</Link>
          <a href="/#apply" className="ngs-pnav-menu-cta">Apply</a>
        </nav>
      )}
    </header>
  );
}

function fmtPhpShort(n) {
  if (!n) return '₱0';
  if (n >= 1000000) return '₱' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '₱' + Math.round(n / 1000) + 'K';
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function HeaderCards({ data, englishHours }) {
  const inv = data.investmentTotals;
  const gpa = data.latestGpa;
  const nextMil = data.nextMilestoneAward;
  const nextTravel = data.nextTravelAward;

  if (!inv && !gpa && !nextMil && !nextTravel && !englishHours) return null;

  return (
    <div className="ngs-phead-cards">
      {inv && (
        <div className="ngs-pc-card">
          <div className="ngs-pc-card-label">Total Investment</div>
          <div className="ngs-pc-card-val">{'₱' + Math.round(inv.total).toLocaleString('en-US')}</div>
          <div className="ngs-pc-card-subs">
            {[['College', inv.college], ['Life', inv.life], ['Milestones', inv.milestone], ['Travel', inv.travel]].map(([label, amt]) => (
              <div key={label} className="ngs-pc-card-sub">
                <span>{label}</span>
                <span>{fmtPhpShort(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {gpa && (
        <div className="ngs-pc-card">
          <div className="ngs-pc-card-label">Latest GPA · {gpa.sem}</div>
          <div className="ngs-pc-card-val">{gpa.value != null ? `${gpa.value}%` : '—'}</div>
          {gpa.value != null && (
            <div className="ngs-pc-card-subs">
              <div className={`ngs-pc-card-sub ngs-pc-gpa-status${gpa.value >= gpa.floor ? ' is-ok' : ' is-warn'}`}>
                {gpa.value >= gpa.floor ? `Above ${gpa.floor}% floor` : `Below ${gpa.floor}% floor`}
              </div>
            </div>
          )}
        </div>
      )}
      {nextMil && (
        <div className="ngs-pc-card">
          <div className="ngs-pc-card-label">Next Milestone</div>
          <div className="ngs-pc-card-val ngs-pc-card-val--sm">{nextMil.name}</div>
          {nextMil.sem && <div className="ngs-pc-card-subs"><div className="ngs-pc-card-sub"><span>Expected</span><span>{nextMil.sem}</span></div></div>}
        </div>
      )}
      {nextTravel && (
        <div className="ngs-pc-card">
          <div className="ngs-pc-card-label">Next Travel Award</div>
          <div className="ngs-pc-card-val ngs-pc-card-val--sm">{nextTravel.dest}</div>
          {nextTravel.sem && <div className="ngs-pc-card-subs"><div className="ngs-pc-card-sub"><span>Expected</span><span>{nextTravel.sem}</span></div></div>}
        </div>
      )}
      {englishHours != null && (
        <div className="ngs-pc-card">
          <div className="ngs-pc-card-label">English Hours</div>
          <div className="ngs-pc-card-val ngs-pc-card-val--sm">{englishHours.hours} <span style={{fontSize:13,opacity:0.6}}>/ {englishHours.goal} hrs</span></div>
        </div>
      )}
    </div>
  );
}

function PhotoHeader({ data, englishHours }) {
  const statusClass = data.status === 'paused' ? 'is-paused' :
                      data.status === 'trial' ? 'is-trial' : 'is-active';
  const hasCards = !!(data.investmentTotals || data.latestGpa || data.nextMilestoneAward || data.nextTravelAward || englishHours);
  return (
    <section className="ngs-phead">
      <div className="ngs-phead-photo">
        <div className="ngs-phead-photo-label">
          <span>portrait</span>
          <span>{data.firstName.toLowerCase()}.jpg</span>
        </div>
        <div className={`ngs-phead-photo-status ${statusClass}`}>
          {data.statusLabel || data.status}
        </div>
      </div>
      <div className="ngs-phead-meta">
        <div className="ngs-phead-track">
          <span className="ngs-phead-track-dot"></span>
          {data.trackName} · {data.track}
        </div>
        <div className={`ngs-phead-meta-inner${hasCards ? ' has-cards' : ''}`}>
          <div className="ngs-phead-meta-left">
            <h1 className="ngs-phead-name">{data.firstName}</h1>
            <p className="ngs-phead-school">
              <strong>{data.school}</strong>{data.city ? ` · ${data.city}` : ''}<br/>
              {data.program} · {data.cohort}
            </p>
          </div>
          {hasCards && <HeaderCards data={data} englishHours={englishHours} />}
        </div>
        {data.headlineStats && (
          <div className="ngs-phead-stats">
            {data.headlineStats.map((s, i) => (
              <div key={i}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PullQuote({ quote }) {
  return (
    <section className="ngs-pquote">
      <span className="ngs-pquote-mark">"</span>
      <p className="ngs-pquote-body">{quote}</p>
    </section>
  );
}

function TrialBanner({ text }) {
  return (
    <section className="ngs-tbanner">
      <div className="ngs-tbanner-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v5l3 2"/>
        </svg>
      </div>
      <p className="ngs-tbanner-text" dangerouslySetInnerHTML={{__html: text}}/>
    </section>
  );
}

function TrialProgressSection({ data }) {
  return (
    <section className="ngs-psection is-paper-2">
      <SectionEyebrow>Trial period</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      <div className="ngs-tprogress">
        {data.semesters.map((s, i) => (
          <div key={i} className={`ngs-tsem is-${s.state}`}>
            <div className="ngs-tsem-label">{s.label}</div>
            <div className="ngs-tsem-grade">{s.grade}</div>
            <div className="ngs-tsem-status">{s.status}</div>
          </div>
        ))}
      </div>

      <div className="ngs-tfloor">
        <span className="ngs-tfloor-mark">▲</span>
        <div>
          <strong>{data.floor}</strong>
          {data.floorDetail && <span className="ngs-tfloor-detail"> — {data.floorDetail}</span>}
        </div>
      </div>

      {data.nextSteps && (
        <div className="ngs-tnext">
          <div className="ngs-tnext-head">What unlocks next</div>
          <div className="ngs-tnext-list">
            {data.nextSteps.map((n, i) => (
              <div key={i} className={`ngs-tnext-row ${n.highlight ? 'is-highlight' : ''}`}>
                <div className="ngs-tnext-name">{n.name}</div>
                <div className="ngs-tnext-detail">{n.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SectionEyebrow({ children }) {
  return (
    <div className="ngs-psection-eyebrow">
      <span className="ngs-psection-eyebrow-rule"></span>
      {children}
    </div>
  );
}

function SemesterSection({ data }) {
  return (
    <section className="ngs-psection">
      <SectionEyebrow>Current semester</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      <div className="ngs-semester-stats">
        <div className="ngs-semstat">
          <div className="ngs-semstat-value">{data.period}</div>
          <div className="ngs-semstat-label">Period</div>
        </div>
        <div className="ngs-semstat">
          <div className="ngs-semstat-value is-gold">{data.year}</div>
          <div className="ngs-semstat-label">Year</div>
        </div>
      </div>

      <div className="ngs-subjects">
        <div className="ngs-subjects-head">Subjects</div>
        {data.subjects.map((s, i) => (
          <div key={i} className="ngs-subject">
            <span className="ngs-subject-num">{String(i+1).padStart(2,'0')}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AcademicSection({ data }) {
  const floorPct = data.current.floor;
  const valuePct = data.current.value;

  return (
    <section className="ngs-psection is-paper-2">
      <SectionEyebrow>Academic standing</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      <div className="ngs-gpa-head">
        <span className="ngs-gpa-label">{data.current.label}</span>
        <span className="ngs-gpa-value">{valuePct}%</span>
      </div>
      <div className="ngs-gpa-bar">
        <div className="ngs-gpa-fill" style={{ width: `${valuePct}%` }}></div>
        <div className="ngs-gpa-floor" style={{ left: `${floorPct}%` }} title="Minimum required"></div>
      </div>
      <div className="ngs-gpa-floor-label">
        Minimum required: {floorPct}% · UV grade scale
      </div>

      {data.history?.length > 0 && (
        <div className="ngs-history">
          <div className="ngs-history-head">History</div>
          {data.history.map((h, i) => (
            <div key={i} className={`ngs-history-row ${h.status === 'active' ? 'is-current' : ''}`}>
              <span className="ngs-history-term">{h.label}</span>
              <span className={`ngs-history-grade is-${h.status}`}>{h.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SupportSection({ data, currency, fxRate }) {
  const totalFormatted = data.total?.rawPhp != null
    ? fmtPhp(data.total.rawPhp, currency, fxRate)
    : data.total?.value;

  return (
    <section className="ngs-psection">
      <SectionEyebrow>Investment</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      {data.total && (
        <div className="ngs-support-summary">
          <div className="ngs-support-summary-label">Total invested to date</div>
          <div className="ngs-support-summary-value">{totalFormatted}</div>
          <div className="ngs-support-summary-foot">{data.total.detail}</div>
          {data.total.progress !== undefined && (
            <div className="ngs-support-progress">
              <div className="ngs-support-progress-label">
                <span>Program completion</span>
                <span>{Math.round(data.total.progress * 100)}%</span>
              </div>
              <div className="ngs-support-progress-bar">
                <div className="ngs-support-progress-fill"
                     style={{ width: `${data.total.progress * 100}%` }}></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ngs-support-cats">
        {data.categories.map((c, i) => {
          const IconComp = NGSIcons[c.icon];
          const amtDisplay = c.amountPhp != null
            ? fmtPhp(c.amountPhp, currency, fxRate)
            : c.amount;
          return (
            <div key={i} className="ngs-support-cat">
              <div className="ngs-support-cat-icon">
                {IconComp && <IconComp size={20}/>}
              </div>
              <div className="ngs-support-cat-body">
                <div className="ngs-support-cat-head">
                  <div className="ngs-support-cat-name">{c.name}</div>
                  {amtDisplay && <div className="ngs-support-cat-amount">{amtDisplay}</div>}
                </div>
                <div className="ngs-support-cat-detail">{c.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MilestonesSection({ items }) {
  return (
    <section className="ngs-psection is-paper-2">
      <SectionEyebrow>Milestones</SectionEyebrow>
      <h2>Rewards along the way.</h2>
      <p className="ngs-psection-intro">
        Devices and infrastructure unlocked as academic targets are hit.
      </p>

      <div className="ngs-mlist">
        {items.map((m, i) => {
          const IconComp = NGSIcons[m.icon];
          const stateClass = m.state === 'done' ? 'is-done' : 'is-future';
          return (
            <div key={i} className={`ngs-mrow ${stateClass}`}>
              <div className="ngs-mrow-icon">
                {IconComp && <IconComp size={20}/>}
              </div>
              <div className="ngs-mrow-body">
                <div className="ngs-mrow-head">
                  <div className="ngs-mrow-name">{m.name}</div>
                  <div className="ngs-mrow-badge">{m.badge || (m.state === 'done' ? 'Done' : 'Future')}</div>
                </div>
                <div className="ngs-mrow-detail">{m.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Vacation Tracker timeline ─────────────────────────────────────────────────

const TRAVEL_SEM_ORDER = [
  'TG11S1','TG11S2','TG12S1','TG12S2',
  'Y1S1','Y1S2','Y2S1','Y2S2',
  'Y3S1','Y3S2','Y4S1','Y4S2','PostY1',
];

const TRAVEL_MILESTONES = [
  { key: 'cebu-entry',   dest: 'Cebu',         label: 'Welcome Excursion',      sub: 'Scholarship Entry · Grade 10', emoji: '🏝', doneGte: 'TG11S1' },
  { key: 'cebu-g11',    dest: 'Cebu',         label: 'Year One Complete',      sub: 'End of Grade 11',              emoji: '🏝', doneGte: 'TG12S1' },
  { key: 'boracay',     dest: 'Boracay',      label: 'High School Graduation', sub: 'End of Grade 12',              emoji: '🌊', doneGte: 'Y1S1'   },
  { key: 'bohol',       dest: 'Bohol',        label: 'Freshman Year Complete', sub: 'End of Year 1',                emoji: '🏖', doneGte: 'Y2S1'   },
  { key: 'hong-kong',   dest: 'Hong Kong',    label: 'Sophomore Year Complete',sub: 'End of Year 2',                emoji: '🌆', doneGte: 'Y3S1'   },
  { key: 'asian-cruise',dest: 'Asian Cruise', label: 'Junior Year Complete',   sub: 'End of Year 3',                emoji: '🚢', doneGte: 'Y4S1'   },
  { key: 'us',          dest: 'United States',label: 'College Graduate',       sub: '3 months · Post-graduation',   emoji: '✈', doneGte: 'PostY1' },
];

function tvSemIdx(sem) {
  return sem ? TRAVEL_SEM_ORDER.indexOf(sem) : -1;
}

function tvGpaClass(gpa, floor) {
  if (gpa == null || floor == null) return 'tm-gpa-amber';
  if (gpa >= floor + 2) return 'tm-gpa-green';
  if (gpa >= floor)     return 'tm-gpa-amber';
  return 'tm-gpa-red';
}

function tvBuildStatuses(items, currentSem) {
  const curIdx = tvSemIdx(currentSem);
  let currentSet = false;
  return TRAVEL_MILESTONES.map(m => {
    const tMatch = (items || []).find(
      t => t.dest?.toLowerCase() === m.dest.toLowerCase() && t.state === 'done'
    );
    if (tMatch) return { ...m, status: 'done' };
    const doneIdx = tvSemIdx(m.doneGte);
    if (doneIdx >= 0 && curIdx >= doneIdx) return { ...m, status: 'done' };
    if (!currentSet) { currentSet = true; return { ...m, status: 'current' }; }
    return { ...m, status: 'future' };
  });
}

function TravelsSection({ items, currentSem, gpaFloor, latestGpa }) {
  const statuses  = tvBuildStatuses(items, currentSem);
  const gc        = tvGpaClass(latestGpa, gpaFloor);
  const nextStop  = statuses.find(m => m.status === 'current');

  return (
    <section className="ngs-psection" id="travel">
      <SectionEyebrow>Vacation tracker</SectionEyebrow>
      <h2>Worlds <em className="ngs-italic">opened.</em></h2>
      <p className="ngs-psection-intro">
        Annual reward trips that scale with milestones — each a deliberate widening of horizons.
      </p>

      {nextStop && (
        <p className="tm-next-callout">
          Next destination · {nextStop.emoji} <strong>{nextStop.dest}</strong> — {nextStop.label}
        </p>
      )}

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
            : m.status === 'current' && latestGpa != null ? `${latestGpa.toFixed(1)}%`
            : m.status === 'current' ? 'Active'
            : 'Upcoming';

          return (
            <div key={m.key} className={cls}>
              <div className="tm-track-col">
                <div className="tm-badge">{m.status === 'done' ? '✓' : m.emoji}</div>
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
    </section>
  );
}

function EnglishSection({ data }) {
  return (
    <section className="ngs-psection is-paper-2">
      <SectionEyebrow>English development</SectionEyebrow>
      <h2>{data.heading}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      <div className="ngs-english is-paper-host">
        <div className="ngs-english-head">
          <div className="ngs-english-title">{data.title}</div>
          <div className="ngs-english-target">Target: {data.target}</div>
        </div>

        <div className="ngs-estages">
          {data.stages.map((s, i) => {
            const railDone = s.state === 'done';
            return (
              <div key={i} className={`ngs-estage is-${s.state}`}>
                <div className={`ngs-estage-rail ${railDone ? 'is-done' : ''}`}></div>
                <div className="ngs-estage-dot">
                  {s.state === 'done' && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-5" stroke="var(--ngs-navy)" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {s.state === 'active' && <span className="ngs-estage-pulse"></span>}
                </div>
                <div className="ngs-estage-body">
                  <div className="ngs-estage-label">{s.label}</div>
                  <div className="ngs-estage-tag">
                    {s.state === 'done' ? 'Done' :
                     s.state === 'active' ? 'In progress' :
                     s.state === 'upcoming' ? 'Upcoming' : 'Future'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PathwaySection({ data }) {
  const pathRef = React.useRef(null);
  const scroll = dir => pathRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });

  return (
    <section className="ngs-psection">
      <SectionEyebrow>Long arc</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      <div className="ngs-pathway" ref={pathRef}>
        <div className="ngs-pathway-track">
          {data.steps.map((s, i) => {
            const isLast = i === data.steps.length - 1;
            return (
              <React.Fragment key={i}>
                <div className={`ngs-pstep is-${s.state}`}>
                  <div className="ngs-pstep-circle">
                    {s.state === 'done' ? (
                      <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                        <path d="M1 5l4 4 8-8" stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : s.state === 'active' ? '★' : i + 1}
                  </div>
                  <div className="ngs-pstep-label" dangerouslySetInnerHTML={{__html: s.label}}/>
                </div>
                {!isLast && (
                  <div className={`ngs-pline ${
                    s.state === 'done' ? 'is-done' :
                    s.connector === 'dashed' ? 'is-dashed' : ''
                  }`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div className="ngs-pathway-footer">
        <p className="ngs-pathway-hint">← Swipe to explore the full pathway</p>
        <div className="ngs-pathway-nav">
          <button className="ngs-pathway-nav-btn" onClick={() => scroll(-1)} aria-label="Scroll pathway left">‹</button>
          <button className="ngs-pathway-nav-btn" onClick={() => scroll(1)} aria-label="Scroll pathway right">›</button>
        </div>
      </div>
    </section>
  );
}

function ProfileFooter({ data, relatedProfiles }) {
  return (
    <footer className="ngs-pfooter">
      <div className="ngs-pfooter-left">One generation lifts another.</div>
      {relatedProfiles?.length > 0 && (
        <div className="ngs-pfooter-links">
          {relatedProfiles.map(p => (
            <Link key={p.href} to={p.href} className="ngs-pfooter-link">
              View {p.name}'s profile →
            </Link>
          ))}
        </div>
      )}
      <div className="ngs-pfooter-meta">
        <span>{data.trackName} · {data.firstName} · {data.cohort}</span>
        <span>{data.updated || 'Updated May 2026'}</span>
      </div>
    </footer>
  );
}
