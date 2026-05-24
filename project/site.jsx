// NextGen Scholars — site sections. Mobile-first, scrolls inside the iOS frame.
// Exports a single <NGSSite/> on window.

const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────────────────────────
// Iconography (geometric, restrained)
// ─────────────────────────────────────────────────────────────
const IconPlane = ({ size = 28, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M3 18.5l26-10.2c.8-.3 1.6.5 1.3 1.3L20.2 35.6"
          stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          transform="translate(0 -4)"/>
    <path d="M3 14.5l26-9.5c.7-.3 1.5.5 1.2 1.3l-9.9 26.6c-.3.8-1.4.8-1.7 0l-4.3-10.4-10.4-4.3c-.8-.3-.8-1.4 0-1.7z"
          stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M14 19l8-8" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconShip = ({ size = 28, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    {/* hull */}
    <path d="M3 22l1.4 4.2c.3.9 1.1 1.5 2 1.5h19.2c.9 0 1.7-.6 2-1.5L29 22H3z"
          stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    {/* superstructure */}
    <path d="M7 22V13h18v9" stroke={color} strokeWidth="1.4"/>
    <path d="M10 13V9h12v4" stroke={color} strokeWidth="1.4"/>
    {/* windows */}
    <path d="M9 17h14" stroke={color} strokeWidth="1.2" strokeDasharray="1.6 2"/>
    {/* funnels */}
    <rect x="12" y="4" width="2.4" height="5" stroke={color} strokeWidth="1.2"/>
    <rect x="17.6" y="4" width="2.4" height="5" stroke={color} strokeWidth="1.2"/>
    {/* water line */}
    <path d="M2 29c2 1 3 -1 5 0s3 1 5 0 3 -1 5 0 3 1 5 0 3 -1 5 0"
          stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
  </svg>
);

const IconArrow = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// 1. HERO — dark navy, subtle Philippine flag motif (triangle + sun rays)
// ─────────────────────────────────────────────────────────────
function Hero({ palette }) {
  return (
    <section className="ngs-hero">
      {/* PH flag motif — barely-there red triangle at left edge with three sun rays */}
      <div className="ngs-hero-flag" aria-hidden="true">
        <svg viewBox="0 0 200 600" preserveAspectRatio="none" width="100%" height="100%">
          <defs>
            <linearGradient id="flagFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={palette.red} stopOpacity="0.18"/>
              <stop offset="1" stopColor={palette.red} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <polygon points="0,0 110,300 0,600" fill="url(#flagFade)"/>
          {/* sun rays from triangle apex */}
          <g stroke={palette.gold} strokeWidth="0.6" opacity="0.55">
            <line x1="110" y1="300" x2="160" y2="270"/>
            <line x1="110" y1="300" x2="170" y2="300"/>
            <line x1="110" y1="300" x2="160" y2="330"/>
          </g>
          <circle cx="110" cy="300" r="3" fill={palette.gold} opacity="0.7"/>
        </svg>
      </div>

      {/* faint grain */}
      <div className="ngs-hero-grain" aria-hidden="true"></div>

      <div className="ngs-hero-inner">
        <div className="ngs-hero-eyebrow">
          <span className="ngs-dot" style={{background: palette.gold}}></span>
          <span>NextGen Scholars · Philippines</span>
        </div>

        <h1 className="ngs-hero-title">
          One generation<br/>
          <em>lifts</em> another.
        </h1>

        <p className="ngs-hero-sub">
          A privately funded mentorship program walking Filipino students from
          classroom to international career — in nursing and in hospitality.
        </p>

        <div className="ngs-hero-cta">
          <a href="#apply" className="ngs-btn ngs-btn-gold">
            Apply for 2026 cohort <IconArrow/>
          </a>
          <a href="#tracks" className="ngs-btn ngs-btn-ghost">See our tracks</a>
        </div>

        <div className="ngs-hero-meta">
          <div><strong>2</strong><span>active tracks</span></div>
          <div className="ngs-hero-meta-rule"></div>
          <div><strong>2<em className="ngs-hero-meta-sep">·</em>1</strong><span>active · paused</span></div>
          <div className="ngs-hero-meta-rule"></div>
          <div><strong>100%</strong><span>privately funded</span></div>
        </div>
      </div>

      <div className="ngs-hero-scroll" aria-hidden="true">
        <span>Scroll</span>
        <div className="ngs-hero-scroll-line"></div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. ABOUT
// ─────────────────────────────────────────────────────────────
function About() {
  return (
    <section className="ngs-section ngs-about" id="about">
      <div className="ngs-eyebrow">
        <span className="ngs-eyebrow-rule"></span>
        About NGS
      </div>
      <h2 className="ngs-h2">
        We invest in people, <span className="ngs-italic">one at a time.</span>
      </h2>
      <p className="ngs-lede">
        NextGen Scholars is a privately funded mentorship program supporting
        Filipino students — run by a single donor based in the United States.
        We sponsor a tightly chosen group of scholars through the full arc of
        their training and into stable international work.
      </p>

      <div className="ngs-pillars">
        <div className="ngs-pillar">
          <div className="ngs-pillar-num">01</div>
          <h3>Chosen carefully</h3>
          <p>Each scholar is sponsored individually. We get to know families before we get to know paperwork.</p>
        </div>
        <div className="ngs-pillar">
          <div className="ngs-pillar-num">02</div>
          <h3>Held the whole way</h3>
          <p>Support begins two years before university — partially during the final two years of high school (select expenses only), then fully from university onward through licensure and international placement.</p>
        </div>
        <div className="ngs-pillar">
          <div className="ngs-pillar-num">03</div>
          <h3>Paid forward</h3>
          <p>Once placed abroad, alumni mentor the next cohort. The next generation lifts the one after.</p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. OUR TRACKS — two cards
// ─────────────────────────────────────────────────────────────
function Tracks({ palette }) {
  const tracks = [
    {
      code: 'NGN',
      name: 'NextGen Nurses',
      Icon: IconPlane,
      blurb: 'Filipino nursing students supported through university and into international licensure.',
      targetNote: 'NCLEX-USA + Australia AHPRA. NCLEX-USA is completed first — it qualifies for both USA and Australia pathways. AHPRA registration follows.',
      steps: [
        'University BSN (4 yrs)',
        'PRC board licensure',
        'OET (English for healthcare)',
        'NCLEX-USA prep & exam',
        'Visa screen + retrogression bridge',
        'Hospital placement (USA / Australia / Singapore)',
      ],
      tint: palette.gold,
    },
    {
      code: 'NGH',
      name: 'NextGen Hospitality',
      Icon: IconShip,
      blurb: 'A vocational pathway from English fluency to luxury hotel and cruise placement.',
      targetNote: 'International cruise lines, with luxury hotels in the Philippines serving as a paid domestic bridge before placement.',
      steps: [
        'English bootcamp (6 mo)',
        'TESDA NC II certification',
        'Luxury hotel rotation (PH)',
        'Cruise line interview prep',
        'Onboard placement (international)',
      ],
      tint: palette.gold,
    },
  ];

  return (
    <section className="ngs-section ngs-tracks" id="tracks">
      <div className="ngs-eyebrow">
        <span className="ngs-eyebrow-rule"></span>
        Our tracks
      </div>
      <h2 className="ngs-h2">Two pathways. <span className="ngs-italic">One promise.</span></h2>
      <p className="ngs-lede ngs-lede-short">
        Every scholar joins one of two structured tracks. Each ends with a
        verified international placement.
      </p>

      <div className="ngs-track-grid">
        {tracks.map(t => (
          <article key={t.code} className="ngs-track-card">
            <div className="ngs-track-head">
              <div className="ngs-track-icon" style={{background: palette.navy}}>
                <t.Icon size={26} color={palette.gold}/>
              </div>
              <div className="ngs-track-code">{t.code}</div>
            </div>
            <h3 className="ngs-track-name">{t.name}</h3>
            <p className="ngs-track-blurb">{t.blurb}</p>

            <div className="ngs-track-target-note">
              <span className="ngs-track-target-label">Target</span>
              <p>{t.targetNote}</p>
            </div>

            <div className="ngs-track-pathway">
              <div className="ngs-track-pathway-label">Pathway</div>
              <ol>
                {t.steps.map((s, i) => (
                  <li key={i}>
                    <span className="ngs-step-num">{String(i+1).padStart(2,'0')}</span>
                    <span className="ngs-step-text">{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <a href="#apply" className="ngs-track-cta">
              Apply to {t.code} <IconArrow/>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. MILESTONES — vertical progress timeline (mobile-friendly)
// ─────────────────────────────────────────────────────────────
function Milestones({ palette }) {
  const stages = [
    { label: 'High school', detail: 'Identification, family interview, trial period' },
    { label: 'University / Bootcamp', detail: 'Full tuition + board, monthly check-ins' },
    { label: 'Licensure', detail: 'PRC board / TESDA NC II / NCLEX-USA' },
    { label: 'Domestic placement', detail: 'PH hospital rotation or luxury hotel' },
    { label: 'International placement', detail: 'USA hospital, Australian hospital, or international cruise contract' },
  ];

  // Active state demo — show the journey progressing
  const [active, setActive] = useState(2);

  return (
    <section className="ngs-section ngs-milestones" id="journey">
      <div className="ngs-eyebrow">
        <span className="ngs-eyebrow-rule"></span>
        Scholar journey
      </div>
      <h2 className="ngs-h2">
        From classroom <span className="ngs-italic">to career.</span>
      </h2>
      <p className="ngs-lede ngs-lede-short">
        Five stages, often six to ten years. We stay through all of it.
      </p>

      <div className="ngs-timeline">
        <div className="ngs-timeline-rail" aria-hidden="true">
          <div className="ngs-timeline-fill" style={{
            height: `${(active / (stages.length - 1)) * 100}%`,
            background: palette.gold,
          }}/>
        </div>

        {stages.map((s, i) => {
          const state = i < active ? 'done' : i === active ? 'now' : 'next';
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`ngs-stage ngs-stage-${state}`}
            >
              <div className="ngs-stage-node" aria-hidden="true">
                {state === 'done' && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5l3.5 3.5L11 1.5" stroke={palette.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {state === 'now' && <span className="ngs-stage-pulse"></span>}
              </div>
              <div className="ngs-stage-body">
                <div className="ngs-stage-step">Stage {String(i+1).padStart(2,'0')}</div>
                <div className="ngs-stage-label">{s.label}</div>
                <div className="ngs-stage-detail">{s.detail}</div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="ngs-timeline-foot">
        <em>Tap a stage</em> to see where a current scholar sits in their journey.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. MEET THE SCHOLARS
// ─────────────────────────────────────────────────────────────
function Scholars({ palette }) {
  const scholars = [
    {
      name: 'Claire',
      track: 'NGN',
      status: 'Active',
      stage: 'University · Year 2',
      year: '2028 cohort',
      quote: 'I want to be a nurse abroad. This program is making that real.',
      progress: 0.35,
      accent: palette.gold,
    },
    {
      name: 'April',
      track: 'NGN',
      status: 'Trial',
      stage: 'Grade 11 trial period',
      year: '2032 cohort',
      quote: 'I’m still in high school, but I already know where I’m going.',
      progress: 0.08,
      accent: palette.gold,
    },
    {
      name: 'Aljane',
      track: 'NGH',
      status: 'Paused',
      stage: 'On hold — external scholarship',
      year: '2028 cohort',
      note: 'Received an external scholarship covering university. NGH remains an option post-graduation.',
      quote: 'My path is on pause, but not forgotten.',
      progress: 0.45,
      accent: palette.red,
    },
  ];

  return (
    <section className="ngs-section ngs-scholars" id="scholars">
      <div className="ngs-eyebrow">
        <span className="ngs-eyebrow-rule"></span>
        Meet the scholars
      </div>
      <h2 className="ngs-h2">
        Three lives <span className="ngs-italic">in motion.</span>
      </h2>
      <p className="ngs-lede ngs-lede-short">
        Names and photos are shared with each scholar’s permission.
      </p>

      <div className="ngs-scholar-list">
        {scholars.map(s => (
          <article key={s.name} className="ngs-scholar-card">
            <div className="ngs-scholar-photo" aria-label={`${s.name} portrait placeholder`}>
              <div className="ngs-scholar-photo-inner">
                <span>portrait</span>
                <span>{s.name.toLowerCase()}.jpg</span>
              </div>
              <div className={`ngs-scholar-badge ngs-scholar-badge-${s.status.toLowerCase()}`}>
                {s.status}
              </div>
            </div>

            <div className="ngs-scholar-body">
              <div className="ngs-scholar-head">
                <h3>{s.name}</h3>
                <span className="ngs-scholar-track">{s.track}</span>
              </div>
              <div className="ngs-scholar-meta">
                <span>{s.stage}</span>
                <span className="ngs-scholar-dot">·</span>
                <span>{s.year}</span>
              </div>

              <blockquote className="ngs-scholar-quote">
                <span className="ngs-scholar-quote-mark">“</span>
                {s.quote}
              </blockquote>

              {s.note && (
                <p className="ngs-scholar-note">{s.note}</p>
              )}

              <div className="ngs-scholar-progress">
                <div className="ngs-scholar-progress-track">
                  <div className="ngs-scholar-progress-fill" style={{
                    width: `${s.progress * 100}%`,
                    background: s.accent,
                  }}/>
                </div>
                <div className="ngs-scholar-progress-label">
                  Journey · {Math.round(s.progress * 100)}%
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. APPLY / CONTACT
// ─────────────────────────────────────────────────────────────
function Apply({ palette }) {
  const [form, setForm] = useState({ name: '', email: '', track: '', message: '' });
  const [sent, setSent] = useState(false);

  const valid = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.track;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    setSent(true);
  };

  return (
    <section className="ngs-section ngs-apply" id="apply">
      <div className="ngs-apply-bg" aria-hidden="true"></div>

      <div className="ngs-apply-inner">
        <div className="ngs-eyebrow ngs-eyebrow-light">
          <span className="ngs-eyebrow-rule ngs-eyebrow-rule-light"></span>
          Apply / Contact
        </div>
        <h2 className="ngs-h2 ngs-h2-light">
          Tell us about <span className="ngs-italic">someone.</span>
        </h2>
        <p className="ngs-lede ngs-lede-light">
          We accept nominations from teachers, family, parish leaders, and
          scholars themselves. We read every message.
        </p>

        {sent ? (
          <div className="ngs-apply-sent">
            <div className="ngs-apply-check" style={{borderColor: palette.gold}}>
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                <path d="M2 9l6 6L20 3" stroke={palette.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Message received.</h3>
            <p>We respond within seven days, in English or Tagalog — whichever is easier.</p>
            <button className="ngs-btn ngs-btn-ghost ngs-btn-ghost-light" onClick={() => { setSent(false); setForm({ name:'', email:'', track:'', message:'' }); }}>
              Send another
            </button>
          </div>
        ) : (
          <form className="ngs-form" onSubmit={submit} noValidate>
            <label className="ngs-field">
              <span>Your name</span>
              <input type="text" value={form.name} placeholder="Maria Santos"
                onChange={e => setForm({...form, name: e.target.value})}/>
            </label>
            <label className="ngs-field">
              <span>Email</span>
              <input type="email" value={form.email} placeholder="maria@example.com"
                onChange={e => setForm({...form, email: e.target.value})}/>
            </label>

            <div className="ngs-field">
              <span>Which track?</span>
              <div className="ngs-radio-row">
                {[
                  { v: 'NGN', label: 'NextGen Nurses' },
                  { v: 'NGH', label: 'NextGen Hospitality' },
                  { v: 'unsure', label: 'Not sure yet' },
                ].map(o => (
                  <button key={o.v} type="button"
                    className={`ngs-radio ${form.track === o.v ? 'is-active' : ''}`}
                    onClick={() => setForm({...form, track: o.v})}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="ngs-field">
              <span>Tell us about the scholar</span>
              <textarea rows="4" value={form.message}
                placeholder="Who are they? What are they studying? How did you come to know them?"
                onChange={e => setForm({...form, message: e.target.value})}/>
            </label>

            <button type="submit" disabled={!valid}
              className={`ngs-btn ngs-btn-gold ngs-btn-full ${!valid ? 'is-disabled' : ''}`}>
              Send nomination <IconArrow/>
            </button>

            <p className="ngs-form-foot">
              Or write directly: <a href="mailto:hello@nextgenscholars.ph">hello@nextgenscholars.ph</a>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="ngs-footer">
      <div className="ngs-footer-mark">
        <div className="ngs-mark">
          <span>N</span><span>G</span><span>S</span>
        </div>
        <div className="ngs-footer-tag">One generation lifts another.</div>
      </div>
      <div className="ngs-footer-cols">
        <div>
          <h4>Tracks</h4>
          <a href="#tracks">NextGen Nurses</a>
          <a href="#tracks">NextGen Hospitality</a>
        </div>
        <div>
          <h4>Program</h4>
          <a href="#about">About</a>
          <a href="#journey">Journey</a>
          <a href="#scholars">Scholars</a>
        </div>
        <div>
          <h4>Get in touch</h4>
          <a href="#apply">Apply</a>
          <a href="mailto:hello@nextgenscholars.ph">hello@nextgenscholars.ph</a>
        </div>
      </div>
      <div className="ngs-footer-fine">
        <span>© 2026 NextGen Scholars · Philippines · United States</span>
        <span>Privately funded · No public donations accepted</span>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// TOP NAV (sticky, mobile-first)
// ─────────────────────────────────────────────────────────────
function TopNav({ palette }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="ngs-nav">
      <div className="ngs-nav-inner">
        <a href="#top" className="ngs-nav-brand">
          <div className="ngs-mark ngs-mark-sm">
            <span>N</span><span>G</span><span>S</span>
          </div>
          <span className="ngs-nav-name">NextGen Scholars</span>
        </a>
        <button className="ngs-nav-btn" onClick={() => setOpen(!open)} aria-label="Menu">
          <span></span><span></span>
        </button>
      </div>
      {open && (
        <nav className="ngs-nav-menu" onClick={() => setOpen(false)}>
          <a href="#about">About</a>
          <a href="#tracks">Tracks</a>
          <a href="#journey">Journey</a>
          <a href="#scholars">Scholars</a>
          <a href="#apply" className="ngs-nav-menu-cta">Apply</a>
        </nav>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSE
// ─────────────────────────────────────────────────────────────
function NGSSite({ palette, isMobile }) {
  return (
    <div className={`ngs-site ${isMobile ? 'is-mobile' : ''}`} id="top" data-screen-label="NGS — Mobile">
      <TopNav palette={palette}/>
      <Hero palette={palette}/>
      <About/>
      <Tracks palette={palette}/>
      <Milestones palette={palette}/>
      <Scholars palette={palette}/>
      <Apply palette={palette}/>
      <Footer/>
    </div>
  );
}

window.NGSSite = NGSSite;
