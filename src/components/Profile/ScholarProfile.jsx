import React from 'react';
import { NGSIcons } from './icons.jsx';

export function ScholarProfile({ data, isMobile }) {
  return (
    <div className={`ngs-profile ${isMobile ? 'is-mobile' : 'is-desktop'}`}
         data-screen-label={`${data.firstName} — Profile`}>
      <TopNav data={data}/>
      <PhotoHeader data={data}/>
      {data.quote && <PullQuote quote={data.quote}/>}
      {data.trialBanner && <TrialBanner text={data.trialBanner}/>}
      {data.trialProgress && <TrialProgressSection data={data.trialProgress}/>}
      {data.currentSemester && <SemesterSection data={data.currentSemester}/>}
      {data.academics && <AcademicSection data={data.academics}/>}
      {data.support && <SupportSection data={data.support}/>}
      {data.milestones && <MilestonesSection items={data.milestones}/>}
      {data.travels && <TravelsSection items={data.travels}/>}
      {data.english && <EnglishSection data={data.english}/>}
      {data.pathway && <PathwaySection data={data.pathway}/>}
      <ProfileFooter data={data}/>
    </div>
  );
}

function TopNav({ data }) {
  return (
    <header className="ngs-pnav">
      <div className="ngs-pnav-inner">
        <a href="index.html" className="ngs-pnav-brand">
          <div className="ngs-mark ngs-mark-sm">
            <span>N</span><span>G</span><span>S</span>
          </div>
          <span className="ngs-pnav-name">NextGen Scholars</span>
        </a>
        <a href="index.html#scholars" className="ngs-pnav-back">All scholars</a>
      </div>
    </header>
  );
}

function PhotoHeader({ data }) {
  const statusClass = data.status === 'paused' ? 'is-paused' :
                      data.status === 'trial' ? 'is-trial' : 'is-active';
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
        <h1 className="ngs-phead-name">{data.firstName}</h1>
        <p className="ngs-phead-school">
          <strong>{data.school}</strong>{data.city ? ` · ${data.city}` : ''}<br/>
          {data.program} · {data.cohort}
        </p>
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

      <div className="ngs-history">
        <div className="ngs-history-head">History</div>
        {data.history.map((h, i) => (
          <div key={i} className={`ngs-history-row ${h.status === 'active' ? 'is-current' : ''}`}>
            <span className="ngs-history-term">{h.label}</span>
            <span className={`ngs-history-grade is-${h.status}`}>{h.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SupportSection({ data }) {
  return (
    <section className="ngs-psection">
      <SectionEyebrow>Investment</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      {data.total && (
        <div className="ngs-support-summary">
          <div className="ngs-support-summary-label">Total invested to date</div>
          <div className="ngs-support-summary-value">{data.total.value}</div>
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
          return (
            <div key={i} className="ngs-support-cat">
              <div className="ngs-support-cat-icon">
                {IconComp && <IconComp size={20}/>}
              </div>
              <div className="ngs-support-cat-body">
                <div className="ngs-support-cat-head">
                  <div className="ngs-support-cat-name">{c.name}</div>
                  {c.amount && <div className="ngs-support-cat-amount">{c.amount}</div>}
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

function TravelsSection({ items }) {
  return (
    <section className="ngs-psection">
      <SectionEyebrow>Travel program</SectionEyebrow>
      <h2>Worlds <em className="ngs-italic">opened.</em></h2>
      <p className="ngs-psection-intro">
        Annual reward trips that scale with milestones — each a deliberate widening of horizons.
      </p>

      <div className="ngs-travels">
        {items.map((t, i) => {
          const IconComp = NGSIcons[t.icon];
          return (
            <article key={i} className={`ngs-travel is-${t.state}`}>
              <div className="ngs-travel-icon">
                {IconComp && <IconComp size={28}/>}
              </div>
              <div className="ngs-travel-dest">{t.dest}</div>
              <div className="ngs-travel-when">{t.when}</div>
              <span className={`ngs-travel-status is-${t.state}`}>
                {t.state === 'done' ? 'Completed' :
                 t.state === 'booked' ? 'Booked' : 'Planned'}
              </span>
            </article>
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
  return (
    <section className="ngs-psection">
      <SectionEyebrow>Long arc</SectionEyebrow>
      <h2>{data.title}</h2>
      <p className="ngs-psection-intro">{data.intro}</p>

      <div className="ngs-pathway">
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
    </section>
  );
}

function ProfileFooter({ data }) {
  return (
    <footer className="ngs-pfooter">
      <div className="ngs-pfooter-left">One generation lifts another.</div>
      <div className="ngs-pfooter-meta">
        <span>{data.trackName} · {data.firstName} · {data.cohort}</span>
        <span>{data.updated || 'Updated May 2026'}</span>
      </div>
    </footer>
  );
}
