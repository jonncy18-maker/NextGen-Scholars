// ─────────────────────────────────────────────────────────────────────────────
// NextGen Scholars — scholars-data.js
// Single source of truth for all scholar data.
// Update this file when adding expenses, milestones, or academic updates.
// Import in navigator.html: <script src="scholars-data.js"></script>
// Last updated: May 2026
// ─────────────────────────────────────────────────────────────────────────────

const NGS_DATA = {

  // ── PROGRAM CONFIG ──────────────────────────────────────────────────────────
  config: {
    exchangeRate: 56,          // PHP per USD — update as needed
    password: 'ngs2026',       // navigator access password
    lastUpdated: '2026-05-30',
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

      // Academic history
      academics: [
        { sem: 'Trial · G12', gpa: 85,    status: 'good' },
        { sem: 'Y1S1',        gpa: null,   status: 'excluded', note: 'Excluded from actuals' },
        { sem: 'Y1S2',        gpa: 83.25,  status: 'good' },
        { sem: 'Y2S1',        gpa: 88.16,  status: 'good' },
        { sem: 'Y2S2',        gpa: 81.36,  status: 'warn' },
      ],

      // Milestones
      milestones: [
        { name: 'Smartphone — Redmi Note',    state: 'done', sem: 'Trial G11',  amountPhp: 7500   },
        { name: 'Chromebook — ASUS 14" 2in1', state: 'done', sem: 'Trial G12',  amountPhp: 26000  },
        { name: 'Motorcycle + License + Gear', state: 'done', sem: 'G12→Y1',   amountPhp: 87000  },
        { name: 'iPhone 13 Pro 128GB',         state: 'done', sem: 'Y1',        amountPhp: 55000  },
        { name: 'iPad 11" A16 128GB',          state: 'done', sem: 'Y2',        amountPhp: 47000  },
        { name: 'Authorized Credit Card',      state: 'done', sem: 'Y2S2',      amountPhp: 0      },
        { name: 'BSN Graduation',              state: 'future', sem: '2028',    amountPhp: 0      },
        { name: 'AHPRA License',               state: 'future', sem: 'Post-2030', amountPhp: 0    },
      ],

      // Travel program
      travels: [
        { dest: 'Boracay',        sem: 'Trial G12', state: 'done',   amountPhp: 28000  },
        { dest: 'Bohol',          sem: 'Y1',        state: 'done',   amountPhp: 35000  },
        { dest: 'Hong Kong',      sem: 'Y2S2',      state: 'done',   amountPhp: 84000  },
        { dest: 'Taiwan Cruise',  sem: 'Y3',        state: 'booked', amountPhp: 70000  },
        { dest: 'Manila B2 Visa', sem: 'Y3-Y4',     state: 'planned', amountPhp: 25000 },
        { dest: 'U.S. Immersion', sem: 'Post-grad', state: 'planned', amountPhp: 0    },
      ],

      // Budgets by semester (PHP)
      budgets: {
        Y1S1: 75000, Y1S2: 151250,
        Y2S1: 151250, Y2S2: 184800,
        Y3S1: 184800, Y3S2: 120000,
        Y4S1: 120000, Y4S2: 120000,
      },

      // ── EXPENSES ────────────────────────────────────────────────────────────
      // Categories: Universidad | Viajes | Milestones
      // Sub-cats: Tuition | Enrollment | Uniforms | Books | Living Expenses |
      //           Printing & Research | School Supplies | Activities |
      //           Medical Equipment | Motor | Other
      expenses: {

        Y1S2: [
          {id:'hY1S2_0', item:'Enrollment fee',              amount:2100,   qty:1, cat:'Enrollment',          date:'2025-01-16', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_1', item:'Nameplate',                   amount:1200,   qty:1, cat:'Enrollment',          date:'2025-01-16', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_2', item:'Uniform',                     amount:2800,   qty:5, cat:'Uniforms',            date:'2025-01-20', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_3', item:'Black Shoes',                 amount:2000,   qty:1, cat:'Uniforms',            date:'2025-01-20', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_4', item:'TOR',                         amount:350,    qty:4, cat:'Enrollment',          date:'2025-01-27', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_5', item:'Good Moral',                  amount:468,    qty:1, cat:'Enrollment',          date:'2025-01-27', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_6', item:'Textbooks',                   amount:2470,   qty:1, cat:'Books',               date:'2025-01-31', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_7', item:'Tuition - Prelim',            amount:6551.03,qty:1, cat:'Tuition',             date:'2025-02-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_8', item:'Extra fee',                   amount:500,    qty:1, cat:'Tuition',             date:'2025-02-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_9', item:'Tuition - Mid-term',          amount:6551.03,qty:1, cat:'Tuition',             date:'2025-03-27', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_10',item:'Tuition - Semi-final',        amount:6551.03,qty:1, cat:'Tuition',             date:'2025-04-19', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_11',item:'Tuition - Final',             amount:6551.03,qty:1, cat:'Tuition',             date:'2025-06-05', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_12',item:'Labs',                        amount:1000,   qty:4, cat:'Enrollment',          date:'2025-01-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_13',item:'PE uniform',                  amount:2065,   qty:1, cat:'Uniforms',            date:'2025-01-29', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_14',item:'Research paper',              amount:10,     qty:500,cat:'Printing & Research', date:'2025-02-15', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_15',item:'Skirt & jacket - down',       amount:1400,   qty:3, cat:'Uniforms',            date:'2025-03-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_16',item:'Skirt & jacket - final',      amount:1400,   qty:3, cat:'Uniforms',            date:'2025-03-18', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_17',item:'Research paper - 2nd',        amount:10,     qty:750,cat:'Printing & Research', date:'2025-02-17', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_24',item:'Nursing dept contribution',   amount:350,    qty:1, cat:'Enrollment',          date:'2025-03-18', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_26',item:'Exam 1',                      amount:820,    qty:1, cat:'Tuition',             date:'2025-06-05', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_27',item:'Exam 2',                      amount:820,    qty:1, cat:'Tuition',             date:'2025-06-05', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY1S2_28',item:'Nameplate Y1S2',              amount:950,    qty:1, cat:'Enrollment',          date:'2025-06-05', sent:'Yes', avb:'Actual', vendor:''},
        ],

        Y2S1: [
          {id:'hY2S1_0', item:'Enrollment fee',              amount:2100,   qty:1, cat:'Enrollment',          date:'2025-07-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_1', item:'Nameplate',                   amount:1200,   qty:1, cat:'Enrollment',          date:'2025-07-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_4', item:'Tuition - Prelim',            amount:11220.03,qty:1,cat:'Tuition',             date:'2025-07-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_5', item:'Tuition - Prelim Fee',        amount:500,    qty:1, cat:'Tuition',             date:'2025-07-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_6', item:'Tuition - Mid-term',          amount:11220.03,qty:1,cat:'Tuition',             date:'2025-08-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_7', item:'Tuition - Mid-term Fee',      amount:500,    qty:1, cat:'Tuition',             date:'2025-08-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_8', item:'Tuition - Semi-final',        amount:11220.03,qty:1,cat:'Tuition',             date:'2025-09-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_9', item:'Tuition - Semi-final Fee',    amount:500,    qty:1, cat:'Tuition',             date:'2025-09-24', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_10',item:'Tuition - Final',             amount:11220.03,qty:1,cat:'Tuition',             date:'2025-11-05', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_11',item:'Tuition - Final Fee',         amount:500,    qty:1, cat:'Tuition',             date:'2025-11-05', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_12',item:'Labs',                        amount:550,    qty:8, cat:'Enrollment',          date:'2025-07-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_16',item:'eBike - Battery',             amount:8500,   qty:1, cat:'Motor',               date:'2025-07-15', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_17',item:'eBike - Chain',               amount:850,    qty:1, cat:'Motor',               date:'2025-07-15', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_38',item:'Clinical activity',           amount:580,    qty:1, cat:'Activities',          date:'2025-09-30', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_39',item:'Food',                        amount:3311,   qty:1, cat:'Living Expenses',     date:'2025-10-07', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_40',item:'Acquaintance party',          amount:2500,   qty:1, cat:'Activities',          date:'2025-10-07', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_53',item:'Nursing Dept contribution',   amount:550,    qty:1, cat:'Activities',          date:'2025-11-26', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_54',item:'Nursing Dept tools',          amount:420,    qty:1, cat:'School Supplies',     date:'2025-11-26', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_55',item:'PE Uniform',                  amount:2000,   qty:1, cat:'Uniforms',            date:'2025-11-26', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_57',item:'Dance costume + Makeup',      amount:3800,   qty:1, cat:'Activities',          date:'2025-11-26', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_58',item:'December Transportation',     amount:3840,   qty:1, cat:'Printing & Research', date:'2025-11-30', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_59',item:'Lantern',                     amount:280,    qty:3, cat:'Activities',          date:'2025-12-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_60',item:'Lights',                      amount:420,    qty:1, cat:'Activities',          date:'2025-12-11', sent:'Yes', avb:'Actual', vendor:''},
          {id:'hY2S1_61',item:'Chicken',                     amount:280,    qty:4, cat:'Activities',          date:'2025-12-11', sent:'Yes', avb:'Actual', vendor:''},
        ],

        Y2S2: [
          {id:1,  item:'Motor Permit',                       amount:3500,   qty:1, cat:'Motor',               date:'2026-01-03', sent:'Yes', avb:'Actual', vendor:''},
          {id:2,  item:'Motor License',                      amount:10500,  qty:1, cat:'Motor',               date:'2026-01-03', sent:'Yes', avb:'Actual', vendor:''},
          {id:3,  item:'Motorcycle',                         amount:65000,  qty:1, cat:'Motor',               date:'2026-01-06', sent:'Yes', avb:'Actual', vendor:''},
          {id:4,  item:'Motor Title Transfer',               amount:5000,   qty:1, cat:'Motor',               date:'2026-01-06', sent:'Yes', avb:'Actual', vendor:''},
          {id:5,  item:'Motor Helmet',                       amount:2100,   qty:1, cat:'Motor',               date:'2026-01-06', sent:'Yes', avb:'Actual', vendor:''},
          {id:6,  item:'Gas - Feb-26',                       amount:234,    qty:1, cat:'Motor',               date:'2026-02-18', sent:'Yes', avb:'Actual', vendor:''},
          {id:7,  item:'Gas - Mar-26',                       amount:700,    qty:1, cat:'Motor',               date:'2026-03-18', sent:'Yes', avb:'Actual', vendor:''},
          {id:10, item:'Motor Muffler Change',               amount:3500,   qty:1, cat:'Motor',               date:'2026-02-22', sent:'Yes', avb:'Actual', vendor:''},
          {id:11, item:'Motor - Side mirror set',            amount:600,    qty:1, cat:'Motor',               date:'2026-02-22', sent:'Yes', avb:'Actual', vendor:''},
          {id:12, item:'Parking Space 2/21-3/20',            amount:1700,   qty:1, cat:'Motor',               date:'2026-02-22', sent:'Yes', avb:'Actual', vendor:''},
          {id:13, item:'Parking Space 3/21-4/20',            amount:1700,   qty:1, cat:'Motor',               date:'2026-03-19', sent:'Yes', avb:'Actual', vendor:''},
          {id:14, item:'Parking Space 4/21-5/20',            amount:1700,   qty:1, cat:'Motor',               date:'2026-04-20', sent:'No',  avb:'Budget', vendor:''},
          {id:15, item:'Parking Space 6/21-7/20',            amount:1700,   qty:1, cat:'Motor',               date:'2026-06-20', sent:'No',  avb:'Budget', vendor:''},
          {id:17, item:'Motorcycle - All repairs',           amount:8000,   qty:1, cat:'Motor',               date:'2026-03-04', sent:'Yes', avb:'Actual', vendor:'Shop'},
          {id:18, item:'Enrollment Fee',                     amount:2100,   qty:1, cat:'Enrollment',          date:'2026-01-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:19, item:'Nameplate',                          amount:1200,   qty:1, cat:'Enrollment',          date:'2026-01-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:20, item:'Enrollment Labs',                    amount:550,    qty:8, cat:'Enrollment',          date:'2026-01-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:21, item:'Tuition - Prelim',                   amount:11220.03,qty:1,cat:'Tuition',             date:'2026-02-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:22, item:'Tuition - Prelim Fee',               amount:500,    qty:1, cat:'Tuition',             date:'2026-02-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:23, item:'Tuition - Mid-term',                 amount:11220.03,qty:1,cat:'Tuition',             date:'2026-03-18', sent:'Yes', avb:'Actual', vendor:''},
          {id:24, item:'Tuition - Mid-term Fee',             amount:500,    qty:1, cat:'Tuition',             date:'2026-03-18', sent:'Yes', avb:'Actual', vendor:''},
          {id:25, item:'Tuition - Semi-final',               amount:11220.03,qty:1,cat:'Tuition',             date:'2026-04-01', sent:'No',  avb:'Budget', vendor:''},
          {id:26, item:'Tuition - Semi-final Fee',           amount:500,    qty:1, cat:'Tuition',             date:'2026-04-01', sent:'No',  avb:'Budget', vendor:''},
          {id:27, item:'Tuition - Final',                    amount:11220.03,qty:1,cat:'Tuition',             date:'2026-05-04', sent:'No',  avb:'Budget', vendor:''},
          {id:28, item:'Tuition - Final Fee',                amount:500,    qty:1, cat:'Tuition',             date:'2026-05-04', sent:'No',  avb:'Budget', vendor:''},
          {id:29, item:'SSG Shirt',                          amount:1200,   qty:1, cat:'Uniforms',            date:'2026-02-07', sent:'Yes', avb:'Actual', vendor:''},
          {id:30, item:'Clinical Uniforms',                  amount:8000,   qty:1, cat:'Uniforms',            date:'2026-02-23', sent:'Yes', avb:'Actual', vendor:''},
          {id:31, item:'Labgown',                            amount:2900,   qty:1, cat:'Uniforms',            date:'2026-02-23', sent:'Yes', avb:'Actual', vendor:''},
          {id:32, item:'Ret Dem Costume rental',             amount:950,    qty:1, cat:'Uniforms',            date:'2026-02-22', sent:'Yes', avb:'Actual', vendor:''},
          {id:33, item:'High heeled shoes',                  amount:1499,   qty:1, cat:'Uniforms',            date:'2026-03-04', sent:'Yes', avb:'Actual', vendor:'Collonade'},
          {id:34, item:'Socks',                              amount:84,     qty:1, cat:'Uniforms',            date:'2026-03-04', sent:'Yes', avb:'Actual', vendor:'Collonade'},
          {id:35, item:'Intrams - Costume',                  amount:1960.31,qty:1, cat:'Uniforms',            date:'2026-03-01', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:36, item:'Textbook - Health Assess. Lecture',  amount:5600,   qty:1, cat:'Books',               date:'2026-01-31', sent:'Yes', avb:'Actual', vendor:''},
          {id:37, item:'Textbook - Health Assess. Lab',      amount:4200,   qty:1, cat:'Books',               date:'2026-01-31', sent:'Yes', avb:'Actual', vendor:''},
          {id:38, item:'Textbook - Microbiology',            amount:5200,   qty:1, cat:'Books',               date:'2026-02-07', sent:'Yes', avb:'Actual', vendor:''},
          {id:39, item:'Textbook - Fundamentals',            amount:4399,   qty:1, cat:'Books',               date:'2026-02-07', sent:'Yes', avb:'Actual', vendor:''},
          {id:40, item:'Oximeter',                           amount:2200,   qty:1, cat:'Medical Equipment',   date:'2026-01-20', sent:'Yes', avb:'Actual', vendor:''},
          {id:41, item:'Penlight',                           amount:850,    qty:1, cat:'Medical Equipment',   date:'2026-02-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:42, item:'Reflex Hammer',                      amount:460,    qty:1, cat:'Medical Equipment',   date:'2026-02-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:43, item:'Thimble',                            amount:620,    qty:1, cat:'Medical Equipment',   date:'2026-02-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:44, item:'Digital Thermometer',                amount:350,    qty:1, cat:'School Supplies',     date:'2026-01-20', sent:'Yes', avb:'Actual', vendor:''},
          {id:45, item:'Crossbody bag',                      amount:1285,   qty:1, cat:'School Supplies',     date:'2026-01-20', sent:'Yes', avb:'Actual', vendor:''},
          {id:46, item:'Stamp',                              amount:1300,   qty:1, cat:'School Supplies',     date:'2026-02-13', sent:'Yes', avb:'Actual', vendor:''},
          {id:47, item:'Labs',                               amount:1000,   qty:1, cat:'School Supplies',     date:'2026-02-01', sent:'Yes', avb:'Actual', vendor:''},
          {id:48, item:'School requirements',                amount:1226.5, qty:1, cat:'School Supplies',     date:'2026-02-05', sent:'Yes', avb:'Actual', vendor:''},
          {id:49, item:'School requirements',                amount:3895.65,qty:1, cat:'School Supplies',     date:'2026-02-04', sent:'Yes', avb:'Actual', vendor:''},
          {id:50, item:'School requirements',                amount:809.6,  qty:1, cat:'School Supplies',     date:'2026-02-02', sent:'Yes', avb:'Actual', vendor:''},
          {id:51, item:'School requirements',                amount:1040.05,qty:1, cat:'School Supplies',     date:'2026-01-31', sent:'Yes', avb:'Actual', vendor:''},
          {id:52, item:'School requirements',                amount:1024.65,qty:1, cat:'School Supplies',     date:'2026-01-31', sent:'Yes', avb:'Actual', vendor:''},
          {id:53, item:'School requirements',                amount:999.34, qty:1, cat:'School Supplies',     date:'2026-02-28', sent:'Yes', avb:'Actual', vendor:'Super Metro'},
          {id:54, item:'School requirements - Feb',          amount:1583.4, qty:1, cat:'School Supplies',     date:'2026-02-25', sent:'Yes', avb:'Actual', vendor:'Super Metro'},
          {id:55, item:'Jollibee',                           amount:261.36, qty:1, cat:'Living Expenses',     date:'2026-02-04', sent:'Yes', avb:'Actual', vendor:'Jollibee'},
          {id:56, item:'Jollibee',                           amount:261.25, qty:1, cat:'Living Expenses',     date:'2026-01-31', sent:'Yes', avb:'Actual', vendor:'Jollibee'},
          {id:57, item:'Jollibee',                           amount:485.1,  qty:1, cat:'Living Expenses',     date:'2026-01-31', sent:'Yes', avb:'Actual', vendor:'Jollibee'},
          {id:58, item:'Gaisano Savers - Snack',             amount:127.6,  qty:1, cat:'Living Expenses',     date:'2026-03-03', sent:'Yes', avb:'Actual', vendor:'Gaisano Savers'},
          {id:59, item:'2 weeks of groceries',               amount:1651.84,qty:1, cat:'Living Expenses',     date:'2026-03-03', sent:'Yes', avb:'Actual', vendor:'Gaisano Main'},
          {id:60, item:'Going out for Dinner',               amount:409.48, qty:1, cat:'Living Expenses',     date:'2026-03-03', sent:'Yes', avb:'Actual', vendor:'Mang Inasal'},
          {id:61, item:'Emergency Food',                     amount:277.82, qty:1, cat:'Living Expenses',     date:'2026-03-02', sent:'Yes', avb:'Actual', vendor:'Jollibee'},
          {id:62, item:'Emergency Food',                     amount:509.82, qty:1, cat:'Living Expenses',     date:'2026-02-27', sent:'Yes', avb:'Actual', vendor:'Jollibee'},
          {id:63, item:'Emergency Food',                     amount:211.12, qty:1, cat:'Living Expenses',     date:'2026-02-26', sent:'Yes', avb:'Actual', vendor:'Jollibee'},
          {id:64, item:'Cake',                               amount:842.16, qty:1, cat:'Living Expenses',     date:'2026-02-16', sent:'Yes', avb:'Actual', vendor:'Goldilocks'},
          {id:65, item:'New bag',                            amount:1289.3, qty:1, cat:'School Supplies',     date:'2026-03-11', sent:'Yes', avb:'Actual', vendor:'Lazada'},
          {id:66, item:'Microscope',                         amount:1000,   qty:1, cat:'Medical Equipment',   date:'2026-03-08', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:67, item:'PPE rental',                         amount:350,    qty:1, cat:'School Supplies',     date:'2026-03-08', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:68, item:'Lab Manual',                         amount:850,    qty:1, cat:'Books',               date:'2026-03-08', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:69, item:'Lab Manual - Fundamentals',          amount:1100,   qty:1, cat:'Books',               date:'2026-03-08', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:70, item:'Sterile gloves',                     amount:750,    qty:1, cat:'School Supplies',     date:'2026-03-18', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:71, item:'Clean gloves',                       amount:280,    qty:1, cat:'School Supplies',     date:'2026-03-18', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:80, item:'Manila Paper & Supplies',            amount:415,    qty:1, cat:'School Supplies',     date:'2026-03-10', sent:'Yes', avb:'Actual', vendor:'Gaisano'},
          {id:81, item:'Manila Paper & Supplies',            amount:290,    qty:1, cat:'School Supplies',     date:'2026-03-10', sent:'Yes', avb:'Actual', vendor:'Gaisano'},
          {id:84, item:'Dinner Allowance - Mar',             amount:200,    qty:12,cat:'Living Expenses',     date:'2026-03-21', sent:'Yes', avb:'Actual', vendor:''},
          {id:82, item:'Dinner Allowance - Apr',             amount:200,    qty:24,cat:'Living Expenses',     date:'2026-04-30', sent:'No',  avb:'Budget', vendor:''},
          {id:83, item:'Dinner Allowance - May',             amount:200,    qty:24,cat:'Living Expenses',     date:'2026-05-31', sent:'No',  avb:'Budget', vendor:''},
          {id:85, item:'School Supplies - Mar',              amount:950,    qty:1, cat:'School Supplies',     date:'2026-03-21', sent:'Yes', avb:'Actual', vendor:''},
          {id:86, item:'Motorbike Lock',                     amount:946.95, qty:1, cat:'Motor',               date:'2026-03-21', sent:'Yes', avb:'Actual', vendor:''},
          {id:87, item:'Petri dish',                         amount:900,    qty:1, cat:'School Supplies',     date:'2026-03-27', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:95, item:'Bacteria - Nutrient broth',          amount:1770,   qty:1, cat:'School Supplies',     date:'2026-04-09', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:96, item:'Bacteria - Tryptic soy broth',       amount:2335,   qty:1, cat:'School Supplies',     date:'2026-04-09', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:97, item:'Bacteria - Peptone water',           amount:715,    qty:1, cat:'School Supplies',     date:'2026-04-09', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:98, item:'Bacteria - Aquarium with sliding door',amount:940,  qty:1, cat:'School Supplies',     date:'2026-04-09', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:99, item:'Retdem - Curved basin',              amount:799,    qty:1, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:100,item:'Retdem - Bite block',                amount:325,    qty:2, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:101,item:'Retdem - Denture cleaner',           amount:655,    qty:1, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:102,item:'Retdem - Bulb syringe',              amount:250,    qty:3, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:103,item:'Retdem - Dental floss holder',       amount:552,    qty:1, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:104,item:'Retdem - Clean gown',                amount:900,    qty:1, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:105,item:'Retdem - Basin stainless',           amount:820,    qty:2, cat:'School Supplies',     date:'2026-04-19', sent:'Yes', avb:'Actual', vendor:'UV'},
          {id:106,item:'Retdem Requirements (bath towels, linen, personal care)', amount:2952,qty:1,cat:'School Supplies',date:'2026-04-23',sent:'Yes',avb:'Actual',vendor:'UV'},
          {id:107,item:'Book rental (3 days)',               amount:3000,   qty:1, cat:'Books',               date:'2026-04-30', sent:'No',  avb:'Budget', vendor:'UV'},
          {id:108,item:'Printing - 115 pages',               amount:15,     qty:115,cat:'Printing & Research',date:'2026-04-30', sent:'No',  avb:'Budget', vendor:''},
          {id:115,item:'Oil change tools',                   amount:3000,   qty:1, cat:'Motor',               date:'2026-05-20', sent:'Yes', avb:'Actual', vendor:''},
          {id:116,item:'Motor oil',                          amount:750,    qty:1, cat:'Motor',               date:'2026-05-20', sent:'Yes', avb:'Actual', vendor:''},
        ],
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

      academics: [
        { sem: 'Grade 10', gpa: 85, status: 'good', note: 'Trial trigger' },
        { sem: 'G11 S1',   gpa: null, status: 'active' },
        { sem: 'G11 S2',   gpa: null, status: 'future' },
        { sem: 'G12 S1',   gpa: null, status: 'future' },
        { sem: 'G12 S2',   gpa: null, status: 'future' },
      ],

      milestones: [
        { name: 'Smartphone — Redmi Note 14', state: 'done', sem: 'Trial G11', amountPhp: 7500 },
        { name: 'Chromebook',                  state: 'future', sem: 'G12',    amountPhp: 26000 },
        { name: 'Motorcycle',                  state: 'future', sem: 'Y1',     amountPhp: 87000 },
        { name: 'iPhone',                      state: 'future', sem: 'Y1',     amountPhp: 55000 },
      ],

      travels: [],

      budgets: {
        TG11S1: 12000, TG11S2: 10000,
        TG12S1: 12000, TG12S2: 10000,
      },

      expenses: {
        TG11S1: [
          { id:'a1', item:'Smartphone — Redmi Note 14 6+128GB', amount:7500, qty:1, cat:'Milestones', date:'2026-04-01', sent:'Yes', avb:'Actual', vendor:'Lazada' },
        ],
      },
    },

    // ── ALJANE ────────────────────────────────────────────────────────────────
    aljane: {
      name: 'Aljane',
      firstName: 'Aljane',
      track: 'NGH',
      school: 'University (External Scholarship)',
      city: 'Cebu',
      program: 'External Scholarship — NGH Paused',
      cohort: 'Cohort 2028',
      status: 'paused',
      currentSem: null,
      gpaFloor: null,
      note: 'External scholarship covering university through Y3/Y4. NGH pathway remains open post-graduation.',

      academics: [],
      milestones: [],
      travels: [],
      budgets: {},
      expenses: {},
    },
  },

  // ── PROGRAM-LEVEL ALERTS ───────────────────────────────────────────────────
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
      title:'Taiwan Cruise confirmed — Jan 2027',
      sub:'MSC Bellissima · 8 pax · Starlux DE89V3. Claire must clear Y3S2 good standing.' },
  ],

  // ── DEADLINES ─────────────────────────────────────────────────────────────
  deadlines: [
    { event:'Y2S2 Final Exams',              scholar:'claire', when:'Jun 2026',     sort:'2026-06-01', cat:'Academic',   urgency:'now'      },
    { event:'Credit Card Milestone',          scholar:'claire', when:'Jun 2026',     sort:'2026-06-15', cat:'Milestone',  urgency:'now'      },
    { event:'April G11 S1 — confirm 85%',    scholar:'april',  when:'~Nov 2025',    sort:'2025-11-01', cat:'Academic',   urgency:'soon'     },
    { event:'ChatGPT Plus Bootcamp',          scholar:'claire', when:'Summer 2026',  sort:'2026-07-01', cat:'English',    urgency:'soon'     },
    { event:'B2 Visa Process Begins',         scholar:'claire', when:'Aug 2026',     sort:'2026-08-01', cat:'Visa',       urgency:'soon'     },
    { event:'Taiwan Cruise — MSC Bellissima', scholar:'claire', when:'Jan 2027',     sort:'2027-01-05', cat:'Travel',     urgency:'upcoming' },
    { event:'Manila B2 Visa Interview',       scholar:'claire', when:'Summer 2027',  sort:'2027-07-01', cat:'Visa',       urgency:'upcoming' },
    { event:'Claire BSN Graduation',          scholar:'claire', when:'2028',         sort:'2028-05-01', cat:'Academic',   urgency:'future'   },
    { event:'PNLE — PH Nursing License',      scholar:'claire', when:'~2028–2029',   sort:'2028-11-01', cat:'Licensure',  urgency:'future'   },
    { event:'OET Grade B',                    scholar:'claire', when:'~2029',        sort:'2029-06-01', cat:'Licensure',  urgency:'future'   },
    { event:'NCLEX-USA (Pearson VUE PH)',     scholar:'claire', when:'~2029',        sort:'2029-09-01', cat:'Licensure',  urgency:'future'   },
    { event:'OSCE — Australia (in-person)',   scholar:'claire', when:'~2030',        sort:'2030-03-01', cat:'Licensure',  urgency:'future'   },
    { event:'AHPRA Registration',             scholar:'claire', when:'~2030',        sort:'2030-06-01', cat:'Licensure',  urgency:'future'   },
    { event:'April BSN Entry (if cleared)',   scholar:'april',  when:'~2027',        sort:'2027-08-01', cat:'Academic',   urgency:'future'   },
  ],

  // ── ACTION ITEMS ───────────────────────────────────────────────────────────
  actions: [
    { id:'ac1', text:'Confirm Claire Y2S2 semester grades when released',             scholar:'claire', cat:'Academic'  },
    { id:'ac2', text:'Log April G11 S1 final grade and assess trial standing',        scholar:'april',  cat:'Academic'  },
    { id:'ac3', text:'Unlock authorized credit card milestone on Y2 completion',      scholar:'claire', cat:'Milestone' },
    { id:'ac4', text:'Subscribe ChatGPT Plus for Claire English bootcamp — Summer 2026', scholar:'claire', cat:'English' },
    { id:'ac5', text:'Begin B2 visa document checklist — Y3S1 start',                scholar:'claire', cat:'Visa'      },
    { id:'ac6', text:'Verify Taiwan cruise pax roster and seat confirmation',         scholar:'claire', cat:'Travel'    },
  ],

};
