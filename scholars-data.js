// ─────────────────────────────────────────────────────────────────────────────
// NextGen Scholars — scholars-data.js
// Narrative and profile content that lives outside Supabase:
//   • english  — mentor observations and stage notes
//   • card     — homepage scholar cards (quote, accent, progress)
//   • publicProfile — rendered copy for claire.html / april.html
//   • config   — exchange rate and password placeholder (loaded from Supabase at runtime)
//   • alerts / deadlines / actions — offline fallback only (Supabase is source of truth)
//
// Operational data (expenses, academics, milestones, travels, budgets) lives
// exclusively in Supabase. Do not add those arrays back here.
// ─────────────────────────────────────────────────────────────────────────────

const NGS_DATA = {

  // ── PROGRAM CONFIG ──────────────────────────────────────────────────────────
  config: {
    exchangeRate: 56,
    password: '',
    lastUpdated: '2026-06-10',
    mentorName: 'John', // greeting + identity card in the Navigator shell
  },

  // ── SCHOLARS ────────────────────────────────────────────────────────────────
  scholars: {

    // ── CLAIRE ────────────────────────────────────────────────────────────────
    claire: {
      name: 'Claire Buenconsejo',
      firstName: 'Claire',
      track: 'NGN',
      school: 'University of the Visayas',
      city: 'Cebu',
      program: 'BSN Nursing',
      cohort: 'Cohort 2028',
      status: 'active',
      currentSem: 'Y2S2',
      gpaFloor: 81,

      // ── ENGLISH DEVELOPMENT ─────────────────────────────────────────────────
      english: {
        scholar: 'Claire · Active',
        stage: 'Stage 3 — English Only in Messenger',
        desc: 'All mentor chat now happens exclusively in English. Fluency is climbing toward the OET preparation window in the senior years.',
        observations: [
          { type: 'pos',     text: 'Initiates conversations in English without prompting.' },
          { type: 'pos',     text: 'Comfortable with clinical and nursing vocabulary.' },
          { type: 'watch',   text: 'Spoken confidence still trails written fluency.' },
          { type: 'pending', text: 'ChatGPT Advanced Voice bootcamp queued for Summer Y3.' },
        ],
      },

      // ── CARD (homepage scholar list) ─────────────────────────────────────────
      card: {
        name: 'Claire',
        track: 'NGN',
        status: 'Active',
        stage: 'University · Year 2',
        year: '2028 cohort',
        quote: 'I want to be a nurse abroad. This program is making that real.',
        progress: 0.35,
        accentKey: 'gold',
        href: 'claire.html',
      },

      // ── PUBLIC PROFILE (claire.html) ─────────────────────────────────────────
      publicProfile: {
        firstName: 'Claire',
        track: 'NGN',
        trackName: 'NextGen Nurses',
        cohort: 'Cohort 2028',
        school: 'University of the Visayas',
        city: 'Cebu',
        program: 'BSN Nursing',
        status: 'active',
        statusLabel: 'Active Scholar',
        updated: 'Updated June 2026',
        quote: 'I want to be a nurse abroad. This program is making that real.',
        headlineStats: [
          { value: 'Y2 · S2', label: 'Current Semester' },
          { value: '2028',    label: 'Graduation' },
          { value: '37%',     label: 'Journey' },
        ],
        currentSemester: {
          title: 'Year Two, Semester Two.',
          intro: 'Jan–Jun 2026. Six concurrent subjects — the densest term of the BSN program so far.',
          period: 'Jan – Jun',
          year: '2026',
          subjects: [
            'Health Assessment',
            'Fundamentals of Nursing Practice',
            'Pharmacology',
            'Care of Mother, Child & Family',
            'Community Health Nursing',
            'NSTP',
          ],
        },
        academics: {
          title: 'Holding the line.',
          intro: 'Claire must maintain an 81% floor to remain in the BSN program. Every semester clears it.',
          current: { label: 'Y2S2 — Latest GPA', value: null, floor: 81 },
        },
        support: {
          title: 'What it takes to lift one.',
          intro: 'A single donor underwrites Claire end-to-end — tuition, board, travel, and the milestone rewards that mark each step.',
          total: {
            value: '₱2.05M',
            rawPhp: 2050000,
            detail: 'Across university, travel program, and milestone rewards through Year 2',
            progress: 0.37,
          },
          categories: [
            { icon: 'cap',    name: 'University',        amount: '₱1.57M', amountPhp: 1570000, detail: 'Tuition, board, supplies, and academic fees across the four-year BSN program.' },
            { icon: 'us',     name: 'Travel Program',    amount: '₱240K',  amountPhp: 240000,  detail: 'Annual reward trips — currently Boracay, Bohol, Hong Kong; future Asian cruise + U.S. immersion.' },
            { icon: 'trophy', name: 'Milestone Rewards', amount: '₱247K',  amountPhp: 247000,  detail: 'Phone, laptop, motorcycle, tablet, credit-card line — earned as each academic target is met.' },
          ],
        },
        milestones: [
          { icon: 'phone',  name: 'Smartphone',             detail: 'Redmi Note · Trial G11 entry',               state: 'done',   badge: 'Done'   },
          { icon: 'laptop', name: 'Chromebook',             detail: 'ASUS 14" 2-in-1 · Grade 12 complete',        state: 'done',   badge: 'Done'   },
          { icon: 'bike',   name: 'Motorcycle',             detail: 'Program infrastructure · Grade 12 complete', state: 'done',   badge: 'Done'   },
          { icon: 'phone',  name: 'iPhone 13 Pro',          detail: '128GB · Year 1 complete',                    state: 'done',   badge: 'Done'   },
          { icon: 'tablet', name: 'iPad 11" A16',           detail: '128GB · Year 2 complete (delivered early)',  state: 'done',   badge: 'Done'   },
          { icon: 'card',   name: 'Authorized Credit Card', detail: "Linked to mentor's account · January 2026",  state: 'done',   badge: 'Done'   },
          { icon: 'cap',    name: 'BSN Graduation',         detail: 'University of the Visayas',                  state: 'future', badge: '2028'   },
          { icon: 'au',     name: 'AHPRA License',          detail: 'Australian Nursing Registration · Post-graduation', state: 'future', badge: 'Future' },
        ],
        travels: [
          { icon: 'beach',    dest: 'Boracay',        when: '2024 · End of Trial G12',          state: 'done'    },
          { icon: 'island',   dest: 'Bohol',          when: '2025 · After Year 1',              state: 'done'    },
          { icon: 'city',     dest: 'Hong Kong',      when: 'Jan 2026 · Year 2 S2',             state: 'done'    },
          { icon: 'ship',     dest: 'Asian Cruise',  when: 'Jan 2027 · MSC Bellissima',        state: 'booked'  },
          { icon: 'building', dest: 'Manila',         when: '2027 · B2 Visa Interview',         state: 'planned' },
          { icon: 'us',       dest: 'U.S. Immersion', when: 'Post-graduation · 3 months · KY', state: 'planned' },
        ],
        english: {
          heading: 'From Cebu to the world.',
          intro: 'A six-stage English development plan — informal at first, structured by year three.',
          title: 'From Cebu to the World',
          target: 'OET Grade B (C1 level)',
          stages: [
            { label: 'Trial G11–G12 · Basic communication with mentor',              state: 'done'     },
            { label: 'Year 1 · Progressive English with mentor',                     state: 'done'     },
            { label: 'Year 2 · FB Messenger exclusively in English with mentor',     state: 'active'   },
            { label: 'Summer Y3 · ChatGPT Advanced Voice Mode bootcamp',             state: 'upcoming' },
            { label: 'Year 3–4 · OET preparation · Target B2+/C1',                  state: 'future'   },
            { label: 'Post-graduation · 3-month U.S. immersion · C1 operational',   state: 'future'   },
          ],
        },
        pathway: {
          title: 'Road to Australia.',
          intro: 'Nine steps from the trial period to a working AHPRA license. The U.S. path stays open as a secondary option.',
          steps: [
            { label: 'Trial<br/>Period',           state: 'done'     },
            { label: 'BSN<br/>University',         state: 'active'   },
            { label: 'PNLE<br/>Philippines',       state: 'next'     },
            { label: '1 Year<br/>Clinical PH',     state: 'next'     },
            { label: 'OET<br/>Grade B',            state: 'next'     },
            { label: 'NCLEX<br/>USA',              state: 'next'     },
            { label: 'OSCE<br/>Australia',         state: 'next'     },
            { label: 'AHPRA<br/>License',          state: 'goal'     },
            { label: 'U.S. Option<br/>(Optional)', state: 'optional', connector: 'dashed' },
          ],
        },
      },
    },

    // ── APRIL ─────────────────────────────────────────────────────────────────
    april: {
      name: 'April',
      firstName: 'April',
      track: 'NGN',
      school: 'Senior High School',
      city: 'Cebu',
      program: 'Grade 11 · Trial Period',
      cohort: 'Cohort 2032',
      status: 'trial',
      currentSem: 'TG11S1',
      gpaFloor: 85,

      // ── ENGLISH DEVELOPMENT ─────────────────────────────────────────────────
      english: {
        scholar: 'April · Trial',
        stage: 'Stage 1 — Foundation',
        desc: 'Building daily communication habits with the mentor during the trial period. Structured English work begins on university entry.',
        observations: [
          { type: 'pos',     text: 'Responds daily to mentor check-ins.' },
          { type: 'watch',   text: 'Mixes Cebuano and English; vocabulary still forming.' },
          { type: 'pending', text: 'Progressive English with mentor starts Year 1.' },
        ],
      },

      // ── CARD (homepage scholar list) ─────────────────────────────────────────
      card: {
        name: 'April',
        track: 'NGN',
        status: 'Trial',
        stage: 'Grade 11 trial period',
        year: '2032 cohort',
        quote: "I'm still in high school, but I already know where I'm going.",
        progress: 0.08,
        accentKey: 'gold',
        href: 'april.html',
      },

      // ── PUBLIC PROFILE (april.html) ──────────────────────────────────────────
      publicProfile: {
        firstName: 'April',
        track: 'NGN',
        trackName: 'NextGen Nurses · Trial',
        cohort: 'Cohort 2032',
        school: 'Senior High School',
        city: 'Cebu',
        program: 'Grade 11 · Trial period',
        status: 'trial',
        statusLabel: 'Trial Scholar',
        updated: 'Updated June 2026',
        quote: "I'm still in high school, but I already know where I'm going.",
        headlineStats: [
          { value: 'G11',   label: 'Current Year' },
          { value: '2 yrs', label: 'Trial Period' },
          { value: '2032',  label: 'BSN Target' },
        ],
        trialBanner:
          'April is in her <strong>2-year trial period</strong> (Grade 11–12). ' +
          'Full NGN scholarship begins on successful Senior High completion with a ' +
          'minimum <strong>85% average</strong>. Trial started June 2026.',
        trialProgress: {
          title: 'Four semesters to clear.',
          intro:
            'Trial began with an 85% average at the end of Grade 10. The same floor ' +
            'must hold every semester to remain in the program.',
          semesters: [
            { label: 'G11 · S1', grade: '—', state: 'active', status: 'In progress' },
            { label: 'G11 · S2', grade: '—', state: 'future', status: 'Upcoming'    },
            { label: 'G12 · S1', grade: '—', state: 'future', status: 'Future'      },
            { label: 'G12 · S2', grade: '—', state: 'future', status: 'Future'      },
          ],
          floor: 'Entry requirement: 85% minimum each semester',
          floorDetail: 'Trial began with 85% average at the end of Grade 10',
          nextSteps: [
            { name: 'Complete G11 → G12',     detail: 'Maintain 85%+ every semester to stay in the program', highlight: true },
            { name: 'Full scholarship entry', detail: 'Upon G12 graduation → BSN Nursing at university' },
            { name: 'Reward — Chromebook',    detail: 'Upon completing Grade 12 successfully' },
            { name: 'Reward — Motorcycle',    detail: 'Primary college transport · Upon completing Grade 12' },
            { name: 'BSN target graduation',  detail: 'Cohort 2032 · Road to Australia begins' },
          ],
        },
        currentSemester: {
          title: 'Grade 11, Semester One.',
          intro: 'Six core subjects. The first semester of a four-semester trial.',
          period: 'G11',
          year: '2026',
          subjects: [
            'Oral Communication',
            '21st Century Literature',
            'General Mathematics',
            'Earth & Life Science',
            'Personal Development',
            'Physical Education',
          ],
        },
        support: {
          title: 'Trial period investment.',
          intro:
            'During the trial period the program provides limited support — enough to ' +
            'demonstrate commitment and keep communication open. Full scholarship ' +
            'investment begins upon university entry.',
          total: {
            value: '₱7.5K',
            rawPhp: 7500,
            detail: 'Trial period support to date (smartphone)',
            progress: 0.04,
          },
          categories: [
            { icon: 'phone', name: 'Smartphone',      amount: '₱7.5K',      amountPhp: 7500, detail: 'Redmi Note 14 · 6+128GB · Provided at trial entry, June 2026.' },
            { icon: 'card',  name: 'Mobile data plan', amount: 'Ongoing',    detail: 'Maintained throughout trial to support daily mentor check-ins.' },
            { icon: 'cap',   name: 'Full scholarship',  amount: 'From 2027', detail: 'Tuition, board, milestone rewards, and travel program activate on BSN entry.' },
          ],
        },
        milestones: [
          { icon: 'check',  name: 'Grade 10 Completed', detail: '85% average · Triggered trial period entry',              state: 'done',   badge: 'Done'     },
          { icon: 'phone',  name: 'Smartphone',          detail: 'Redmi Note 14 · 6+128GB · Trial G11 entry · June 2026',  state: 'done',   badge: 'Done'     },
          { icon: 'cap',    name: 'Complete Grade 11',   detail: '85% minimum required to continue trial',                 state: 'future', badge: 'In Trial' },
          { icon: 'cap',    name: 'Complete Grade 12',   detail: '85% minimum · Unlocks full scholarship',                 state: 'future', badge: '2027'     },
          { icon: 'laptop', name: 'Chromebook',          detail: 'Upon completing Grade 12',                               state: 'future', badge: '2027'     },
          { icon: 'bike',   name: 'Motorcycle',          detail: 'Primary college transport · Grade 12 complete',         state: 'future', badge: '2027'     },
          { icon: 'phone',  name: 'iPhone',              detail: 'Year 1 university complete',                             state: 'future', badge: '2028'     },
          { icon: 'au',     name: 'AHPRA License',       detail: 'Australian Nursing Registration · Post-graduation',      state: 'future', badge: 'Future'   },
        ],
        english: {
          heading: 'Building the foundation.',
          intro:
            'Five stages — informal at first, then structured English work begins in ' +
            'university. OET preparation comes in the senior years.',
          title: 'Building the Foundation',
          target: 'OET Grade B (C1 level) · Post-graduation',
          stages: [
            { label: 'Trial G11–G12 · Basic communication with mentor · Building habits', state: 'active' },
            { label: 'Year 1 university · Progressive English with mentor',               state: 'future' },
            { label: 'Year 2 · FB Messenger exclusively in English with mentor',          state: 'future' },
            { label: 'Summer Y3 · ChatGPT Advanced Voice Mode bootcamp',                  state: 'future' },
            { label: 'Year 3–4 · OET preparation · Target B2+/C1',                       state: 'future' },
          ],
        },
        pathway: {
          title: 'Road to Australia.',
          intro: 'Same nine-step pathway as Claire — April is at step one.',
          steps: [
            { label: 'Trial<br/>Period',           state: 'active'   },
            { label: 'BSN<br/>University',         state: 'next'     },
            { label: 'PNLE<br/>Philippines',       state: 'next'     },
            { label: '1 Year<br/>Clinical PH',     state: 'next'     },
            { label: 'OET<br/>Grade B',            state: 'next'     },
            { label: 'NCLEX<br/>USA',              state: 'next'     },
            { label: 'OSCE<br/>Australia',         state: 'next'     },
            { label: 'AHPRA<br/>License',          state: 'goal'     },
            { label: 'U.S. Option<br/>(Optional)', state: 'optional', connector: 'dashed' },
          ],
        },
      },
    },

    // ── JANNDILYNE ──────────────────────────────────────────────────────────────
    // TESDA track — a separate, unadvertised one-off program. No English hours
    // tracking and no travel/vacation program (unlike NGN/NGH scholars). Deliberately
    // has no `english` or `card` field: she must not appear on the public homepage.
    // NOTE: placeholder copy below — owner to confirm full name, program/NC, city,
    // cohort, and quote.
    janndilyne: {
      name: 'Janndilyne',
      firstName: 'Janndilyne',
      track: 'TESDA',
      school: 'TESDA Training Center',        // TODO: confirm institution
      city: 'Cebu',                            // TODO: confirm city
      program: 'TESDA NC II',                  // TODO: confirm program / qualification
      cohort: 'Cohort 2026',                   // TODO: confirm cohort
      status: 'active',
      currentSem: 'TESDA',                     // single rolling term (no semester progression)
      gpaFloor: null,

      // ── PUBLIC PROFILE (/janndilyne) ─────────────────────────────────────────
      // No `travels` and no `english` keys — those sections are omitted by design
      // (ScholarProfile renders them conditionally).
      publicProfile: {
        firstName: 'Janndilyne',
        track: 'TESDA',
        trackName: 'NextGen TESDA',
        cohort: 'Cohort 2026',
        school: 'TESDA Training Center',
        city: 'Cebu',
        program: 'TESDA NC II',
        status: 'active',
        statusLabel: 'Active Scholar',
        updated: 'Updated June 2026',
        quote: 'A skilled trade is a passport. This program is helping me earn mine.', // TODO: confirm
        headlineStats: [
          { value: 'In Training', label: 'Current Stage' },
          { value: 'NC II',       label: 'Target Cert' },
          { value: '2026',        label: 'Certification' },
        ],
        currentSemester: {
          title: 'In training.',
          intro: 'Working toward TESDA National Certificate competency assessment.',
          period: 'TESDA',
          year: '2026',
          subjects: [
            'Core competency units',         // TODO: confirm units
            'Workplace English',
            'Trade theory',
            'Practical / hands-on training',
          ],
        },
        academics: {
          title: 'Competency, not GPA.',
          intro: 'TESDA progress is measured by competency-based assessment rather than a semester GPA.',
          current: { label: 'Latest Assessment', value: null, floor: null },
        },
        support: {
          title: 'What it takes to lift one.',
          intro: 'A single donor underwrites Janndilyne end-to-end — training fees, materials, and the milestone rewards that mark each step.',
          total: {
            value: '—',
            rawPhp: 0,
            detail: 'Training fees, materials, and milestone rewards',
            progress: 0,
          },
          categories: [
            { icon: 'cap',    name: 'Training & Assessment', amount: '—', detail: 'Course fees, registration, and TESDA assessment fees.' },
            { icon: 'trophy', name: 'Milestone Rewards',     amount: '—', detail: 'Earned as each competency target is met.' },
          ],
        },
        milestones: [
          { icon: 'check', name: 'Enrolled in TESDA program', detail: 'Training started · 2026', state: 'done',   badge: 'Done'   },
          { icon: 'cap',   name: 'NC II Certification',       detail: 'Competency assessment',   state: 'future', badge: 'Future' },
        ],
        pathway: {
          title: 'From training to placement.',
          intro: 'A vocational pathway from TESDA certification toward stable employment.',
          steps: [
            { label: 'TESDA<br/>Training',     state: 'active'   },
            { label: 'NC II<br/>Assessment',   state: 'next'     },
            { label: 'Certification',          state: 'next'     },
            { label: 'Placement',              state: 'goal'     },
          ],
        },
      },
    },

    // ── JANNDILYNE ──────────────────────────────────────────────────────────────
    // TESDA track — a separate, unadvertised one-off program. No English hours
    // tracking and no travel/vacation program (unlike NGN/NGH scholars). Deliberately
    // has no `english` or `card` field: she must not appear on the public homepage.
    // NOTE: placeholder copy below — owner to confirm full name, program/NC, city,
    // cohort, and quote.
    janndilyne: {
      name: 'Janndilyne',
      firstName: 'Janndilyne',
      track: 'TESDA',
      school: 'TESDA Training Center',        // TODO: confirm institution
      city: 'Cebu',                            // TODO: confirm city
      program: 'TESDA NC II',                  // TODO: confirm program / qualification
      cohort: 'Cohort 2026',                   // TODO: confirm cohort
      status: 'active',
      currentSem: 'TESDA',                     // single rolling term (no semester progression)
      gpaFloor: null,

      // ── PUBLIC PROFILE (/janndilyne) ─────────────────────────────────────────
      // No `travels` and no `english` keys — those sections are omitted by design
      // (ScholarProfile renders them conditionally).
      publicProfile: {
        firstName: 'Janndilyne',
        track: 'TESDA',
        trackName: 'NextGen TESDA',
        cohort: 'Cohort 2026',
        school: 'TESDA Training Center',
        city: 'Cebu',
        program: 'TESDA NC II',
        status: 'active',
        statusLabel: 'Active Scholar',
        updated: 'Updated June 2026',
        quote: 'A skilled trade is a passport. This program is helping me earn mine.', // TODO: confirm
        headlineStats: [
          { value: 'In Training', label: 'Current Stage' },
          { value: 'NC II',       label: 'Target Cert' },
          { value: '2026',        label: 'Certification' },
        ],
        currentSemester: {
          title: 'In training.',
          intro: 'Working toward TESDA National Certificate competency assessment.',
          period: 'TESDA',
          year: '2026',
          subjects: [
            'Core competency units',         // TODO: confirm units
            'Workplace English',
            'Trade theory',
            'Practical / hands-on training',
          ],
        },
        academics: {
          title: 'Competency, not GPA.',
          intro: 'TESDA progress is measured by competency-based assessment rather than a semester GPA.',
          current: { label: 'Latest Assessment', value: null, floor: null },
        },
        support: {
          title: 'What it takes to lift one.',
          intro: 'A single donor underwrites Janndilyne end-to-end — training fees, materials, and the milestone rewards that mark each step.',
          total: {
            value: '—',
            rawPhp: 0,
            detail: 'Training fees, materials, and milestone rewards',
            progress: 0,
          },
          categories: [
            { icon: 'cap',    name: 'Training & Assessment', amount: '—', detail: 'Course fees, registration, and TESDA assessment fees.' },
            { icon: 'trophy', name: 'Milestone Rewards',     amount: '—', detail: 'Earned as each competency target is met.' },
          ],
        },
        milestones: [
          { icon: 'check', name: 'Enrolled in TESDA program', detail: 'Training started · 2026', state: 'done',   badge: 'Done'   },
          { icon: 'cap',   name: 'NC II Certification',       detail: 'Competency assessment',   state: 'future', badge: 'Future' },
        ],
        pathway: {
          title: 'From training to placement.',
          intro: 'A vocational pathway from TESDA certification toward stable employment.',
          steps: [
            { label: 'TESDA<br/>Training',     state: 'active'   },
            { label: 'NC II<br/>Assessment',   state: 'next'     },
            { label: 'Certification',          state: 'next'     },
            { label: 'Placement',              state: 'goal'     },
          ],
        },
      },
    },
  },

  // ── OFFLINE FALLBACK — Supabase is source of truth for all of the below ─────
  alerts: [
    { id:'a1', severity:'amber', icon:'⚠️', scholar:'claire',
      title:'Claire GPA watch — Y2S2 in progress',
      sub:'Y2S1 closed at 81.36% — just above the 81% UV floor. Y2S2 results pending.' },
    { id:'a2', severity:'amber', icon:'⏳', scholar:'april',
      title:'April G11 S1 grade not yet confirmed',
      sub:'Trial gate: must clear 85%. No grade recorded yet.' },
    { id:'a3', severity:'blue',  icon:'🛂', scholar:'claire',
      title:'B2 Visa process — initiation in Y3S1 (Aug 2026)',
      sub:'Documentation and interview prep begin next semester.' },
    { id:'a4', severity:'blue',  icon:'🚢', scholar:'claire',
      title:'Asian Cruise confirmed — Jan 2027',
      sub:'MSC Bellissima · 8 pax · Starlux DE89V3. Claire must clear Y3S2 good standing.' },
  ],

  deadlines: [
    { event:'Y2S2 Final Exams',              scholar:'claire', when:'Jun 2026',     sort:'2026-06-01', cat:'Academic',   urgency:'now'      },
    { event:'Credit Card Milestone',          scholar:'claire', when:'Jun 2026',     sort:'2026-06-15', cat:'Milestone',  urgency:'now'      },
    { event:'April G11 S1 — confirm 85%',    scholar:'april',  when:'~Nov 2026',    sort:'2026-11-01', cat:'Academic',   urgency:'soon'     },
    { event:'ChatGPT Plus Bootcamp',          scholar:'claire', when:'Summer 2026',  sort:'2026-07-01', cat:'English',    urgency:'soon'     },
    { event:'B2 Visa Process Begins',         scholar:'claire', when:'Aug 2026',     sort:'2026-08-01', cat:'Visa',       urgency:'soon'     },
    { event:'Asian Cruise — MSC Bellissima', scholar:'claire', when:'Jan 2027',     sort:'2027-01-05', cat:'Travel',     urgency:'upcoming' },
    { event:'Manila B2 Visa Interview',       scholar:'claire', when:'Summer 2027',  sort:'2027-07-01', cat:'Visa',       urgency:'upcoming' },
    { event:'Claire BSN Graduation',          scholar:'claire', when:'2028',         sort:'2028-05-01', cat:'Academic',   urgency:'future'   },
    { event:'PNLE — PH Nursing License',      scholar:'claire', when:'~2028–2029',   sort:'2028-11-01', cat:'Licensure',  urgency:'future'   },
    { event:'OET Grade B',                    scholar:'claire', when:'~2029',        sort:'2029-06-01', cat:'Licensure',  urgency:'future'   },
    { event:'NCLEX-USA (Pearson VUE PH)',     scholar:'claire', when:'~2029',        sort:'2029-09-01', cat:'Licensure',  urgency:'future'   },
    { event:'OSCE — Australia (in-person)',   scholar:'claire', when:'~2030',        sort:'2030-03-01', cat:'Licensure',  urgency:'future'   },
    { event:'AHPRA Registration',             scholar:'claire', when:'~2030',        sort:'2030-06-01', cat:'Licensure',  urgency:'future'   },
    { event:'April BSN Entry (if cleared)',   scholar:'april',  when:'~2027',        sort:'2027-08-01', cat:'Academic',   urgency:'future'   },
  ],

  actions: [
    { id:'ac1', text:'Confirm Claire Y2S2 semester grades when released',                scholar:'claire', cat:'Academic'  },
    { id:'ac2', text:'Log April G11 S1 final grade and assess trial standing',           scholar:'april',  cat:'Academic'  },
    { id:'ac3', text:'Unlock authorized credit card milestone on Y2 completion',         scholar:'claire', cat:'Milestone' },
    { id:'ac4', text:'Subscribe ChatGPT Plus for Claire English bootcamp — Summer 2026', scholar:'claire', cat:'English'   },
    { id:'ac5', text:'Begin B2 visa document checklist — Y3S1 start',                   scholar:'claire', cat:'Visa'      },
    { id:'ac6', text:'Verify Asian cruise pax roster and seat confirmation',            scholar:'claire', cat:'Travel'    },
  ],

};

export { NGS_DATA };
