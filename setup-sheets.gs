// ─────────────────────────────────────────────────────────────────────────────
// NextGen Scholars — Google Sheets setup script
// Paste this into Extensions > Apps Script in the NGS spreadsheet, then run
// setupNGSData(). It creates all tabs and loads current data from scholars-data.js.
// Safe to re-run: clears and repopulates each sheet.
// ─────────────────────────────────────────────────────────────────────────────

function setupNGSData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  setupConfig(ss);
  setupScholars(ss);
  setupAcademics(ss);
  setupMilestones(ss);
  setupTravels(ss);
  setupBudgets(ss);
  setupExpenses(ss);
  setupAlerts(ss);
  setupDeadlines(ss);
  setupActions(ss);

  // Remove default empty Sheet1 if it still exists
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  SpreadsheetApp.flush();
  Browser.msgBox('✅ NGS data loaded into all tabs!');
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeSheet(ss, name, headers, rows) {
  const sh = getOrCreate(ss, name);
  sh.clearContents();

  // Header row — bold + light blue fill
  const headerRange = sh.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#c9daf8');

  if (rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

function setupConfig(ss) {
  writeSheet(ss, 'Config',
    ['key', 'value', 'notes'],
    [
      ['exchangeRate', 56,          'PHP per USD — update as needed'],
      ['password',    'ngs2026',    'Navigator access (cosmetic only — not real security)'],
      ['lastUpdated', '2026-05-30', 'Update whenever you edit data'],
    ]
  );
}

// ── SCHOLARS ──────────────────────────────────────────────────────────────────

function setupScholars(ss) {
  writeSheet(ss, 'Scholars',
    ['scholarKey', 'name', 'firstName', 'track', 'school', 'city', 'program', 'cohort', 'status', 'currentSem', 'gpaFloor', 'cardStage', 'cardYear', 'quote', 'cardProgress', 'note'],
    [
      ['claire', 'Claire Buenconsejo', 'Claire', 'NGN', 'University of the Visayas', 'Cebu', 'BSN Nursing', 'Cohort 2028', 'active', 'Y2S2', 81, 'University · Year 2', '2028 cohort', 'I want to be a nurse abroad. This program is making that real.', 0.35, ''],
      ['april',  'April',              'April',  'NGN', 'Senior High School',        'Cebu', 'Grade 11 · Trial Period', 'Cohort 2032', 'trial', 'TG11S1', 85, 'Grade 11 trial period', '2032 cohort', "I'm still in high school, but I already know where I'm going.", 0.08, ''],
      ['aljane', 'Aljane',             'Aljane', 'NGH', 'University (External Scholarship)', 'Cebu', 'External Scholarship — NGH Paused', 'Cohort 2028', 'paused', '', '', 'On hold — external scholarship', '2028 cohort', 'My path is on pause, but not forgotten.', 0.45, 'Received an external scholarship covering university. NGH remains an option post-graduation.'],
    ]
  );
}

// ── ACADEMICS ─────────────────────────────────────────────────────────────────

function setupAcademics(ss) {
  writeSheet(ss, 'Academics',
    ['scholar', 'sem', 'gpa', 'status', 'note'],
    [
      ['claire', 'Trial · G12', 85,    'good',     ''],
      ['claire', 'Y1S1',        '',    'excluded', 'Excluded from actuals'],
      ['claire', 'Y1S2',        83.25, 'good',     ''],
      ['claire', 'Y2S1',        88.16, 'good',     ''],
      ['claire', 'Y2S2',        81.36, 'warn',     ''],
      ['april',  'Grade 10',    85,    'good',     'Trial trigger'],
      ['april',  'G11 S1',      '',    'active',   ''],
      ['april',  'G11 S2',      '',    'future',   ''],
      ['april',  'G12 S1',      '',    'future',   ''],
      ['april',  'G12 S2',      '',    'future',   ''],
    ]
  );
}

// ── MILESTONES ────────────────────────────────────────────────────────────────

function setupMilestones(ss) {
  writeSheet(ss, 'Milestones',
    ['scholar', 'name', 'state', 'sem', 'amountPhp'],
    [
      // Claire
      ['claire', 'Smartphone — Redmi Note',     'done',   'Trial G11',  7500],
      ['claire', 'Chromebook — ASUS 14" 2in1',  'done',   'Trial G12',  26000],
      ['claire', 'Motorcycle + License + Gear', 'done',   'G12→Y1',     87000],
      ['claire', 'iPhone 13 Pro 128GB',          'done',   'Y1',         55000],
      ['claire', 'iPad 11" A16 128GB',           'done',   'Y2',         47000],
      ['claire', 'Authorized Credit Card',       'done',   'Y2S2',       0],
      ['claire', 'BSN Graduation',               'future', '2028',       0],
      ['claire', 'AHPRA License',                'future', 'Post-2030',  0],
      // April
      ['april',  'Smartphone — Redmi Note 14',  'done',   'Trial G11',  7500],
      ['april',  'Chromebook',                  'future', 'G12',        26000],
      ['april',  'Motorcycle',                  'future', 'Y1',         87000],
      ['april',  'iPhone',                      'future', 'Y1',         55000],
    ]
  );
}

// ── TRAVELS ───────────────────────────────────────────────────────────────────

function setupTravels(ss) {
  writeSheet(ss, 'Travels',
    ['scholar', 'dest', 'sem', 'state', 'amountPhp'],
    [
      ['claire', 'Boracay',        'Trial G12',  'done',    28000],
      ['claire', 'Bohol',          'Y1',         'done',    35000],
      ['claire', 'Hong Kong',      'Y2S2',       'done',    84000],
      ['claire', 'Taiwan Cruise',  'Y3',         'booked',  70000],
      ['claire', 'Manila B2 Visa', 'Y3-Y4',      'planned', 25000],
      ['claire', 'U.S. Immersion', 'Post-grad',  'planned', 0],
    ]
  );
}

// ── BUDGETS ───────────────────────────────────────────────────────────────────

function setupBudgets(ss) {
  writeSheet(ss, 'Budgets',
    ['scholar', 'sem', 'amountPhp'],
    [
      // Claire
      ['claire', 'Y1S1',   75000],
      ['claire', 'Y1S2',   151250],
      ['claire', 'Y2S1',   151250],
      ['claire', 'Y2S2',   184800],
      ['claire', 'Y3S1',   184800],
      ['claire', 'Y3S2',   120000],
      ['claire', 'Y4S1',   120000],
      ['claire', 'Y4S2',   120000],
      // April
      ['april',  'TG11S1', 12000],
      ['april',  'TG11S2', 10000],
      ['april',  'TG12S1', 12000],
      ['april',  'TG12S2', 10000],
    ]
  );
}

// ── EXPENSES ──────────────────────────────────────────────────────────────────
// avb values: 'Actual' (money already sent) | 'Budget' (planned, not yet sent)
// sent values: 'Yes' | 'No'
// cats: Tuition | Enrollment | Uniforms | Books | Living Expenses |
//       Printing & Research | School Supplies | Activities |
//       Medical Equipment | Motor | Milestones | Other

function setupExpenses(ss) {
  const headers = ['scholar', 'sem', 'id', 'item', 'amount', 'qty', 'cat', 'date', 'sent', 'avb', 'vendor'];

  const rows = [
    // ── CLAIRE Y1S2 ──────────────────────────────────────────────────────────
    ['claire','Y1S2','hY1S2_0',  'Enrollment fee',              2100,    1, 'Enrollment',          '2025-01-16', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_1',  'Nameplate',                   1200,    1, 'Enrollment',          '2025-01-16', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_2',  'Uniform',                     2800,    5, 'Uniforms',            '2025-01-20', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_3',  'Black Shoes',                 2000,    1, 'Uniforms',            '2025-01-20', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_4',  'TOR',                         350,     4, 'Enrollment',          '2025-01-27', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_5',  'Good Moral',                  468,     1, 'Enrollment',          '2025-01-27', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_6',  'Textbooks',                   2470,    1, 'Books',               '2025-01-31', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_7',  'Tuition - Prelim',            6551.03, 1, 'Tuition',             '2025-02-11', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_8',  'Extra fee',                   500,     1, 'Tuition',             '2025-02-11', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_9',  'Tuition - Mid-term',          6551.03, 1, 'Tuition',             '2025-03-27', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_10', 'Tuition - Semi-final',        6551.03, 1, 'Tuition',             '2025-04-19', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_11', 'Tuition - Final',             6551.03, 1, 'Tuition',             '2025-06-05', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_12', 'Labs',                        1000,    4, 'Enrollment',          '2025-01-24', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_13', 'PE uniform',                  2065,    1, 'Uniforms',            '2025-01-29', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_14', 'Research paper',              10,    500, 'Printing & Research', '2025-02-15', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_15', 'Skirt & jacket - down',       1400,    3, 'Uniforms',            '2025-03-11', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_16', 'Skirt & jacket - final',      1400,    3, 'Uniforms',            '2025-03-18', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_17', 'Research paper - 2nd',        10,    750, 'Printing & Research', '2025-02-17', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_24', 'Nursing dept contribution',   350,     1, 'Enrollment',          '2025-03-18', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_26', 'Exam 1',                      820,     1, 'Tuition',             '2025-06-05', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_27', 'Exam 2',                      820,     1, 'Tuition',             '2025-06-05', 'Yes', 'Actual', ''],
    ['claire','Y1S2','hY1S2_28', 'Nameplate Y1S2',              950,     1, 'Enrollment',          '2025-06-05', 'Yes', 'Actual', ''],
    // ── CLAIRE Y2S1 ──────────────────────────────────────────────────────────
    ['claire','Y2S1','hY2S1_0',  'Enrollment fee',              2100,    1, 'Enrollment',          '2025-07-11', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_1',  'Nameplate',                   1200,    1, 'Enrollment',          '2025-07-11', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_4',  'Tuition - Prelim',            11220.03,1, 'Tuition',             '2025-07-24', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_5',  'Tuition - Prelim Fee',        500,     1, 'Tuition',             '2025-07-24', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_6',  'Tuition - Mid-term',          11220.03,1, 'Tuition',             '2025-08-24', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_7',  'Tuition - Mid-term Fee',      500,     1, 'Tuition',             '2025-08-24', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_8',  'Tuition - Semi-final',        11220.03,1, 'Tuition',             '2025-09-24', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_9',  'Tuition - Semi-final Fee',    500,     1, 'Tuition',             '2025-09-24', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_10', 'Tuition - Final',             11220.03,1, 'Tuition',             '2025-11-05', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_11', 'Tuition - Final Fee',         500,     1, 'Tuition',             '2025-11-05', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_12', 'Labs',                        550,     8, 'Enrollment',          '2025-07-11', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_16', 'eBike - Battery',             8500,    1, 'Motor',               '2025-07-15', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_17', 'eBike - Chain',               850,     1, 'Motor',               '2025-07-15', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_38', 'Clinical activity',           580,     1, 'Activities',          '2025-09-30', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_39', 'Food',                        3311,    1, 'Living Expenses',     '2025-10-07', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_40', 'Acquaintance party',          2500,    1, 'Activities',          '2025-10-07', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_53', 'Nursing Dept contribution',   550,     1, 'Activities',          '2025-11-26', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_54', 'Nursing Dept tools',          420,     1, 'School Supplies',     '2025-11-26', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_55', 'PE Uniform',                  2000,    1, 'Uniforms',            '2025-11-26', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_57', 'Dance costume + Makeup',      3800,    1, 'Activities',          '2025-11-26', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_58', 'December Transportation',     3840,    1, 'Printing & Research', '2025-11-30', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_59', 'Lantern',                     280,     3, 'Activities',          '2025-12-11', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_60', 'Lights',                      420,     1, 'Activities',          '2025-12-11', 'Yes', 'Actual', ''],
    ['claire','Y2S1','hY2S1_61', 'Chicken',                     280,     4, 'Activities',          '2025-12-11', 'Yes', 'Actual', ''],
    // ── CLAIRE Y2S2 ──────────────────────────────────────────────────────────
    ['claire','Y2S2',1,   'Motor Permit',                        3500,    1, 'Motor',               '2026-01-03', 'Yes', 'Actual', ''],
    ['claire','Y2S2',2,   'Motor License',                       10500,   1, 'Motor',               '2026-01-03', 'Yes', 'Actual', ''],
    ['claire','Y2S2',3,   'Motorcycle',                          65000,   1, 'Motor',               '2026-01-06', 'Yes', 'Actual', ''],
    ['claire','Y2S2',4,   'Motor Title Transfer',                5000,    1, 'Motor',               '2026-01-06', 'Yes', 'Actual', ''],
    ['claire','Y2S2',5,   'Motor Helmet',                        2100,    1, 'Motor',               '2026-01-06', 'Yes', 'Actual', ''],
    ['claire','Y2S2',6,   'Gas - Feb-26',                        234,     1, 'Motor',               '2026-02-18', 'Yes', 'Actual', ''],
    ['claire','Y2S2',7,   'Gas - Mar-26',                        700,     1, 'Motor',               '2026-03-18', 'Yes', 'Actual', ''],
    ['claire','Y2S2',10,  'Motor Muffler Change',                3500,    1, 'Motor',               '2026-02-22', 'Yes', 'Actual', ''],
    ['claire','Y2S2',11,  'Motor - Side mirror set',             600,     1, 'Motor',               '2026-02-22', 'Yes', 'Actual', ''],
    ['claire','Y2S2',12,  'Parking Space 2/21-3/20',             1700,    1, 'Motor',               '2026-02-22', 'Yes', 'Actual', ''],
    ['claire','Y2S2',13,  'Parking Space 3/21-4/20',             1700,    1, 'Motor',               '2026-03-19', 'Yes', 'Actual', ''],
    ['claire','Y2S2',14,  'Parking Space 4/21-5/20',             1700,    1, 'Motor',               '2026-04-20', 'No',  'Budget', ''],
    ['claire','Y2S2',15,  'Parking Space 6/21-7/20',             1700,    1, 'Motor',               '2026-06-20', 'No',  'Budget', ''],
    ['claire','Y2S2',17,  'Motorcycle - All repairs',            8000,    1, 'Motor',               '2026-03-04', 'Yes', 'Actual', 'Shop'],
    ['claire','Y2S2',18,  'Enrollment Fee',                      2100,    1, 'Enrollment',          '2026-01-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',19,  'Nameplate',                           1200,    1, 'Enrollment',          '2026-01-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',20,  'Enrollment Labs',                     550,     8, 'Enrollment',          '2026-01-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',21,  'Tuition - Prelim',                    11220.03,1, 'Tuition',             '2026-02-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',22,  'Tuition - Prelim Fee',                500,     1, 'Tuition',             '2026-02-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',23,  'Tuition - Mid-term',                  11220.03,1, 'Tuition',             '2026-03-18', 'Yes', 'Actual', ''],
    ['claire','Y2S2',24,  'Tuition - Mid-term Fee',              500,     1, 'Tuition',             '2026-03-18', 'Yes', 'Actual', ''],
    ['claire','Y2S2',25,  'Tuition - Semi-final',                11220.03,1, 'Tuition',             '2026-04-01', 'No',  'Budget', ''],
    ['claire','Y2S2',26,  'Tuition - Semi-final Fee',            500,     1, 'Tuition',             '2026-04-01', 'No',  'Budget', ''],
    ['claire','Y2S2',27,  'Tuition - Final',                     11220.03,1, 'Tuition',             '2026-05-04', 'No',  'Budget', ''],
    ['claire','Y2S2',28,  'Tuition - Final Fee',                 500,     1, 'Tuition',             '2026-05-04', 'No',  'Budget', ''],
    ['claire','Y2S2',29,  'SSG Shirt',                           1200,    1, 'Uniforms',            '2026-02-07', 'Yes', 'Actual', ''],
    ['claire','Y2S2',30,  'Clinical Uniforms',                   8000,    1, 'Uniforms',            '2026-02-23', 'Yes', 'Actual', ''],
    ['claire','Y2S2',31,  'Labgown',                             2900,    1, 'Uniforms',            '2026-02-23', 'Yes', 'Actual', ''],
    ['claire','Y2S2',32,  'Ret Dem Costume rental',              950,     1, 'Uniforms',            '2026-02-22', 'Yes', 'Actual', ''],
    ['claire','Y2S2',33,  'High heeled shoes',                   1499,    1, 'Uniforms',            '2026-03-04', 'Yes', 'Actual', 'Collonade'],
    ['claire','Y2S2',34,  'Socks',                               84,      1, 'Uniforms',            '2026-03-04', 'Yes', 'Actual', 'Collonade'],
    ['claire','Y2S2',35,  'Intrams - Costume',                   1960.31, 1, 'Uniforms',            '2026-03-01', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',36,  'Textbook - Health Assess. Lecture',   5600,    1, 'Books',               '2026-01-31', 'Yes', 'Actual', ''],
    ['claire','Y2S2',37,  'Textbook - Health Assess. Lab',       4200,    1, 'Books',               '2026-01-31', 'Yes', 'Actual', ''],
    ['claire','Y2S2',38,  'Textbook - Microbiology',             5200,    1, 'Books',               '2026-02-07', 'Yes', 'Actual', ''],
    ['claire','Y2S2',39,  'Textbook - Fundamentals',             4399,    1, 'Books',               '2026-02-07', 'Yes', 'Actual', ''],
    ['claire','Y2S2',40,  'Oximeter',                            2200,    1, 'Medical Equipment',   '2026-01-20', 'Yes', 'Actual', ''],
    ['claire','Y2S2',41,  'Penlight',                            850,     1, 'Medical Equipment',   '2026-02-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',42,  'Reflex Hammer',                       460,     1, 'Medical Equipment',   '2026-02-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',43,  'Thimble',                             620,     1, 'Medical Equipment',   '2026-02-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',44,  'Digital Thermometer',                 350,     1, 'School Supplies',     '2026-01-20', 'Yes', 'Actual', ''],
    ['claire','Y2S2',45,  'Crossbody bag',                       1285,    1, 'School Supplies',     '2026-01-20', 'Yes', 'Actual', ''],
    ['claire','Y2S2',46,  'Stamp',                               1300,    1, 'School Supplies',     '2026-02-13', 'Yes', 'Actual', ''],
    ['claire','Y2S2',47,  'Labs',                                1000,    1, 'School Supplies',     '2026-02-01', 'Yes', 'Actual', ''],
    ['claire','Y2S2',48,  'School requirements',                 1226.5,  1, 'School Supplies',     '2026-02-05', 'Yes', 'Actual', ''],
    ['claire','Y2S2',49,  'School requirements',                 3895.65, 1, 'School Supplies',     '2026-02-04', 'Yes', 'Actual', ''],
    ['claire','Y2S2',50,  'School requirements',                 809.6,   1, 'School Supplies',     '2026-02-02', 'Yes', 'Actual', ''],
    ['claire','Y2S2',51,  'School requirements',                 1040.05, 1, 'School Supplies',     '2026-01-31', 'Yes', 'Actual', ''],
    ['claire','Y2S2',52,  'School requirements',                 1024.65, 1, 'School Supplies',     '2026-01-31', 'Yes', 'Actual', ''],
    ['claire','Y2S2',53,  'School requirements',                 999.34,  1, 'School Supplies',     '2026-02-28', 'Yes', 'Actual', 'Super Metro'],
    ['claire','Y2S2',54,  'School requirements - Feb',           1583.4,  1, 'School Supplies',     '2026-02-25', 'Yes', 'Actual', 'Super Metro'],
    ['claire','Y2S2',55,  'Jollibee',                            261.36,  1, 'Living Expenses',     '2026-02-04', 'Yes', 'Actual', 'Jollibee'],
    ['claire','Y2S2',56,  'Jollibee',                            261.25,  1, 'Living Expenses',     '2026-01-31', 'Yes', 'Actual', 'Jollibee'],
    ['claire','Y2S2',57,  'Jollibee',                            485.1,   1, 'Living Expenses',     '2026-01-31', 'Yes', 'Actual', 'Jollibee'],
    ['claire','Y2S2',58,  'Gaisano Savers - Snack',              127.6,   1, 'Living Expenses',     '2026-03-03', 'Yes', 'Actual', 'Gaisano Savers'],
    ['claire','Y2S2',59,  '2 weeks of groceries',                1651.84, 1, 'Living Expenses',     '2026-03-03', 'Yes', 'Actual', 'Gaisano Main'],
    ['claire','Y2S2',60,  'Going out for Dinner',                409.48,  1, 'Living Expenses',     '2026-03-03', 'Yes', 'Actual', 'Mang Inasal'],
    ['claire','Y2S2',61,  'Emergency Food',                      277.82,  1, 'Living Expenses',     '2026-03-02', 'Yes', 'Actual', 'Jollibee'],
    ['claire','Y2S2',62,  'Emergency Food',                      509.82,  1, 'Living Expenses',     '2026-02-27', 'Yes', 'Actual', 'Jollibee'],
    ['claire','Y2S2',63,  'Emergency Food',                      211.12,  1, 'Living Expenses',     '2026-02-26', 'Yes', 'Actual', 'Jollibee'],
    ['claire','Y2S2',64,  'Cake',                                842.16,  1, 'Living Expenses',     '2026-02-16', 'Yes', 'Actual', 'Goldilocks'],
    ['claire','Y2S2',65,  'New bag',                             1289.3,  1, 'School Supplies',     '2026-03-11', 'Yes', 'Actual', 'Lazada'],
    ['claire','Y2S2',66,  'Microscope',                          1000,    1, 'Medical Equipment',   '2026-03-08', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',67,  'PPE rental',                          350,     1, 'School Supplies',     '2026-03-08', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',68,  'Lab Manual',                          850,     1, 'Books',               '2026-03-08', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',69,  'Lab Manual - Fundamentals',           1100,    1, 'Books',               '2026-03-08', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',70,  'Sterile gloves',                      750,     1, 'School Supplies',     '2026-03-18', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',71,  'Clean gloves',                        280,     1, 'School Supplies',     '2026-03-18', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',80,  'Manila Paper & Supplies',             415,     1, 'School Supplies',     '2026-03-10', 'Yes', 'Actual', 'Gaisano'],
    ['claire','Y2S2',81,  'Manila Paper & Supplies',             290,     1, 'School Supplies',     '2026-03-10', 'Yes', 'Actual', 'Gaisano'],
    ['claire','Y2S2',84,  'Dinner Allowance - Mar',              200,    12, 'Living Expenses',     '2026-03-21', 'Yes', 'Actual', ''],
    ['claire','Y2S2',82,  'Dinner Allowance - Apr',              200,    24, 'Living Expenses',     '2026-04-30', 'No',  'Budget', ''],
    ['claire','Y2S2',83,  'Dinner Allowance - May',              200,    24, 'Living Expenses',     '2026-05-31', 'No',  'Budget', ''],
    ['claire','Y2S2',85,  'School Supplies - Mar',               950,     1, 'School Supplies',     '2026-03-21', 'Yes', 'Actual', ''],
    ['claire','Y2S2',86,  'Motorbike Lock',                      946.95,  1, 'Motor',               '2026-03-21', 'Yes', 'Actual', ''],
    ['claire','Y2S2',87,  'Petri dish',                          900,     1, 'School Supplies',     '2026-03-27', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',95,  'Bacteria - Nutrient broth',           1770,    1, 'School Supplies',     '2026-04-09', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',96,  'Bacteria - Tryptic soy broth',        2335,    1, 'School Supplies',     '2026-04-09', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',97,  'Bacteria - Peptone water',            715,     1, 'School Supplies',     '2026-04-09', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',98,  'Bacteria - Aquarium with sliding door', 940,   1, 'School Supplies',     '2026-04-09', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',99,  'Retdem - Curved basin',               799,     1, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',100, 'Retdem - Bite block',                 325,     2, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',101, 'Retdem - Denture cleaner',            655,     1, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',102, 'Retdem - Bulb syringe',               250,     3, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',103, 'Retdem - Dental floss holder',        552,     1, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',104, 'Retdem - Clean gown',                 900,     1, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',105, 'Retdem - Basin stainless',            820,     2, 'School Supplies',     '2026-04-19', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',106, 'Retdem Requirements (bath towels, linen, personal care)', 2952, 1, 'School Supplies', '2026-04-23', 'Yes', 'Actual', 'UV'],
    ['claire','Y2S2',107, 'Book rental (3 days)',                3000,    1, 'Books',               '2026-04-30', 'No',  'Budget', 'UV'],
    ['claire','Y2S2',108, 'Printing - 115 pages',                15,    115, 'Printing & Research', '2026-04-30', 'No',  'Budget', ''],
    ['claire','Y2S2',115, 'Oil change tools',                    3000,    1, 'Motor',               '2026-05-20', 'Yes', 'Actual', ''],
    ['claire','Y2S2',116, 'Motor oil',                           750,     1, 'Motor',               '2026-05-20', 'Yes', 'Actual', ''],
    // ── APRIL TG11S1 ─────────────────────────────────────────────────────────
    ['april', 'TG11S1','a1', 'Smartphone — Redmi Note 14 6+128GB', 7500, 1, 'Milestones', '2026-04-01', 'Yes', 'Actual', 'Lazada'],
  ];

  writeSheet(ss, 'Expenses', headers, rows);
}

// ── ALERTS ────────────────────────────────────────────────────────────────────

function setupAlerts(ss) {
  writeSheet(ss, 'Alerts',
    ['id', 'severity', 'icon', 'scholar', 'title', 'sub'],
    [
      ['a1', 'amber', '⚠️', 'claire', 'Claire GPA watch — Y2S2 in progress',      'Y2S1 closed at 81.36% — just above the 81% UV floor. Y2S2 results pending.'],
      ['a2', 'amber', '⏳', 'april',  'April G11 S1 grade not yet confirmed',     'Trial gate: must clear 85%. No grade recorded yet.'],
      ['a3', 'blue',  '🛂', 'claire', 'B2 Visa process — initiation in Y3S1 (Aug 2026)', 'Documentation and interview prep begin next semester.'],
      ['a4', 'blue',  '🚢', 'claire', 'Taiwan Cruise confirmed — Jan 2027',       'MSC Bellissima · 8 pax · Starlux DE89V3. Claire must clear Y3S2 good standing.'],
    ]
  );
}

// ── DEADLINES ─────────────────────────────────────────────────────────────────

function setupDeadlines(ss) {
  writeSheet(ss, 'Deadlines',
    ['event', 'scholar', 'when', 'sortDate', 'cat', 'urgency'],
    [
      ['Y2S2 Final Exams',              'claire', 'Jun 2026',      '2026-06-01', 'Academic',  'now'],
      ['Credit Card Milestone',         'claire', 'Jun 2026',      '2026-06-15', 'Milestone', 'now'],
      ['April G11 S1 — confirm 85%',   'april',  '~Nov 2025',     '2025-11-01', 'Academic',  'soon'],
      ['ChatGPT Plus Bootcamp',         'claire', 'Summer 2026',   '2026-07-01', 'English',   'soon'],
      ['B2 Visa Process Begins',        'claire', 'Aug 2026',      '2026-08-01', 'Visa',      'soon'],
      ['Taiwan Cruise — MSC Bellissima','claire', 'Jan 2027',      '2027-01-05', 'Travel',    'upcoming'],
      ['Manila B2 Visa Interview',      'claire', 'Summer 2027',   '2027-07-01', 'Visa',      'upcoming'],
      ['Claire BSN Graduation',         'claire', '2028',          '2028-05-01', 'Academic',  'future'],
      ['PNLE — PH Nursing License',     'claire', '~2028–2029',    '2028-11-01', 'Licensure', 'future'],
      ['OET Grade B',                   'claire', '~2029',         '2029-06-01', 'Licensure', 'future'],
      ['NCLEX-USA (Pearson VUE PH)',    'claire', '~2029',         '2029-09-01', 'Licensure', 'future'],
      ['OSCE — Australia (in-person)',  'claire', '~2030',         '2030-03-01', 'Licensure', 'future'],
      ['AHPRA Registration',            'claire', '~2030',         '2030-06-01', 'Licensure', 'future'],
      ['April BSN Entry (if cleared)',  'april',  '~2027',         '2027-08-01', 'Academic',  'future'],
    ]
  );
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────

function setupActions(ss) {
  writeSheet(ss, 'Actions',
    ['id', 'text', 'scholar', 'cat'],
    [
      ['ac1', 'Confirm Claire Y2S2 semester grades when released',                'claire', 'Academic'],
      ['ac2', 'Log April G11 S1 final grade and assess trial standing',           'april',  'Academic'],
      ['ac3', 'Unlock authorized credit card milestone on Y2 completion',         'claire', 'Milestone'],
      ['ac4', 'Subscribe ChatGPT Plus for Claire English bootcamp — Summer 2026', 'claire', 'English'],
      ['ac5', 'Begin B2 visa document checklist — Y3S1 start',                   'claire', 'Visa'],
      ['ac6', 'Verify Taiwan cruise pax roster and seat confirmation',            'claire', 'Travel'],
    ]
  );
}
