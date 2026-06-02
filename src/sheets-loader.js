// Fetches NGS program data from Google Sheets and returns it in the same
// shape as scholars-data.js so navigator.jsx needs no structural changes.
//
// Requires the spreadsheet to be shared "Anyone with the link — Viewer".
// Spreadsheet: https://docs.google.com/spreadsheets/d/1EuTStd26Ret7E9ph1syI_YMKAPIEuPeNjMN6G4b7Cuw

const SHEET_ID = '1EuTStd26Ret7E9ph1syI_YMKAPIEuPeNjMN6G4b7Cuw';

async function fetchCSV(sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets fetch failed: ${sheetName} (${res.status})`);
  return parseCSV(await res.text());
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

function parseCSVRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function maybeNum(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export async function loadFromSheets() {
  const [
    configRows, scholarRows, academicRows, milestoneRows,
    travelRows, budgetRows, expenseRows, alertRows, deadlineRows, actionRows,
  ] = await Promise.all([
    fetchCSV('Config'),
    fetchCSV('Scholars'),
    fetchCSV('Academics'),
    fetchCSV('Milestones'),
    fetchCSV('Travels'),
    fetchCSV('Budgets'),
    fetchCSV('Expenses'),
    fetchCSV('Alerts'),
    fetchCSV('Deadlines'),
    fetchCSV('Actions'),
  ]);

  // Config
  const configMap = {};
  configRows.forEach(r => { configMap[r.key] = r.value; });

  // Scholars
  const scholars = {};
  scholarRows.forEach(s => {
    const key = s.scholarKey;

    // Expenses grouped by semester
    const expenses = {};
    expenseRows
      .filter(e => e.scholar === key)
      .forEach(e => {
        const sem = e.sem;
        if (!expenses[sem]) expenses[sem] = [];
        expenses[sem].push({
          id: e.id,
          item: e.item,
          amount: num(e.amount),
          qty: num(e.qty) || 1,
          cat: e.cat,
          date: e.date,
          sent: e.sent,
          avb: e.avb,
          vendor: e.vendor || '',
        });
      });

    scholars[key] = {
      name: s.name,
      firstName: s.firstName,
      track: s.track,
      school: s.school,
      city: s.city,
      program: s.program,
      cohort: s.cohort,
      status: s.status,
      currentSem: s.currentSem,
      gpaFloor: maybeNum(s.gpaFloor),
      ...(s.note ? { note: s.note } : {}),

      academics: academicRows
        .filter(r => r.scholar === key)
        .map(r => ({
          sem: r.sem,
          gpa: maybeNum(r.gpa),
          status: r.status,
          ...(r.note ? { note: r.note } : {}),
        })),

      milestones: milestoneRows
        .filter(r => r.scholar === key)
        .map(r => ({
          name: r.name,
          state: r.state,
          sem: r.sem,
          amountPhp: num(r.amountPhp),
        })),

      travels: travelRows
        .filter(r => r.scholar === key)
        .map(r => ({
          dest: r.dest,
          sem: r.sem,
          state: r.state,
          amountPhp: num(r.amountPhp),
        })),

      budgets: Object.fromEntries(
        budgetRows
          .filter(r => r.scholar === key)
          .map(r => [r.sem, num(r.amountPhp)])
      ),

      expenses,

      card: {
        name: s.firstName,
        track: s.track,
        status: s.status.charAt(0).toUpperCase() + s.status.slice(1),
        stage: s.cardStage,
        year: s.cardYear,
        quote: s.quote,
        progress: num(s.cardProgress),
        accentKey: s.status === 'paused' ? 'red' : 'gold',
        ...(key !== 'aljane' ? { href: `${key}.html` } : {}),
        ...(s.note ? { note: s.note } : {}),
      },
    };
  });

  return {
    config: {
      exchangeRate: num(configMap.exchangeRate) || 56,
      password: configMap.password || '',
      lastUpdated: configMap.lastUpdated || '',
    },
    scholars,
    alerts: alertRows.map(a => ({
      id: a.id,
      severity: a.severity,
      icon: a.icon,
      scholar: a.scholar,
      title: a.title,
      sub: a.sub,
    })),
    deadlines: deadlineRows.map(d => ({
      event: d.event,
      scholar: d.scholar,
      when: d.when,
      sort: d.sortDate,
      cat: d.cat,
      urgency: d.urgency,
    })),
    actions: actionRows.map(a => ({
      id: a.id,
      text: a.text,
      scholar: a.scholar,
      cat: a.cat,
    })),
  };
}
