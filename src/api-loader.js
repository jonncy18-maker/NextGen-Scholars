// Fetches NGS program data from the Next.js API (Neon-backed) and returns it
// in the same shape as scholars-data.js so navigator.jsx needs no structural
// changes. Same exported names/signatures as the old src/supabase-loader.js
// it replaces — the merge/coercion logic below is unchanged, only the data
// source (one api.get('/bootstrap') call instead of a 10-way Supabase
// Promise.all) is different.

import { api } from './lib/api.js';
import { CAT_TO_BUCKET } from './constants.js';

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function maybeNum(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export async function loadFromSupabase() {
  const {
    config: configRows,
    scholars: scholarRows,
    academics: academicRows,
    milestones: milestoneRows,
    travels: travelRows,
    budgets: budgetRows,
    expenses: expenseRows,
    alerts: alertRows,
    deadlines: deadlineRows,
    actions: actionRows,
  } = await api.get('/bootstrap');

  const configMap = {};
  (configRows || []).forEach(r => { configMap[r.key] = r.value; });

  const scholars = {};
  (scholarRows || []).forEach(s => {
    const key = s.scholar_key;

    const expenses = {};
    (expenseRows || [])
      .filter(e => e.scholar === key)
      .forEach(e => {
        const sem = e.sem;
        if (!expenses[sem]) expenses[sem] = [];
        const rawBucket = CAT_TO_BUCKET[e.cat] ?? e.bucket ?? 'college';
        expenses[sem].push({
          id:     e.id,
          item:   e.item,
          amount: num(e.amount),
          qty:    num(e.qty) || 1,
          cat:    e.cat,
          bucket: rawBucket === 'trial' ? 'college' : rawBucket,
          date:   e.date,
          sent:   e.sent,
          avb:    e.avb,
          vendor: e.vendor || '',
        });
      });

    scholars[key] = {
      name:       s.name,
      firstName:  s.first_name,
      track:      s.track,
      school:     s.school,
      city:       s.city,
      program:    s.program,
      cohort:     s.cohort,
      status:     s.status,
      currentSem: s.current_sem,
      gpaFloor:   maybeNum(s.gpa_floor),
      ...(s.note ? { note: s.note } : {}),

      academics: (academicRows || [])
        .filter(r => r.scholar === key)
        .map(r => ({
          sem:    r.sem,
          gpa:    maybeNum(r.gpa),
          status: r.status,
          ...(r.note ? { note: r.note } : {}),
        })),

      milestones: (milestoneRows || [])
        .filter(r => r.scholar === key)
        .map(r => ({
          name:      r.name,
          state:     r.state,
          sem:       r.sem,
          amountPhp: num(r.amount_php),
        })),

      travels: (travelRows || [])
        .filter(r => r.scholar === key)
        .map(r => ({
          dest:      r.dest,
          sem:       r.sem,
          state:     r.state,
          amountPhp: num(r.amount_php),
        })),

      budgets: Object.fromEntries(
        (budgetRows || [])
          .filter(r => r.scholar === key)
          .map(r => [r.sem, num(r.amount_php)])
      ),

      expenses,

      card: {
        name:      s.first_name,
        track:     s.track,
        status:    s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Active',
        stage:     s.card_stage,
        year:      s.card_year,
        quote:     s.quote,
        progress:  num(s.card_progress),
        accentKey: s.status === 'paused' ? 'red' : 'gold',
        href: `${key}.html`,
        ...(s.note ? { note: s.note } : {}),
      },
    };
  });

  return {
    config: {
      exchangeRate: num(configMap.exchangeRate) || 56,
      lastUpdated:  configMap.lastUpdated || '',
    },
    scholars,
    alerts: (alertRows || []).map(a => ({
      id:       a.id,
      severity: a.severity,
      icon:     a.icon,
      scholar:  a.scholar,
      title:    a.title,
      sub:      a.sub,
    })),
    deadlines: (deadlineRows || []).map(d => ({
      event:   d.event,
      scholar: d.scholar,
      when:    d.when_date,
      sort:    d.sort_date,
      cat:     d.cat,
      urgency: d.urgency,
    })),
    actions: (actionRows || []).map(a => ({
      id:      a.id,
      text:    a.text,
      scholar: a.scholar,
      cat:     a.cat,
    })),
  };
}

export async function loadPendingSubmissions() {
  return api.get('/submissions?status=pending');
}

export async function loadScholarSubmissions(_scholarKey) {
  // The server derives the caller's own scholar_key from the JWT (?mine=1);
  // the parameter is kept for call-site parity with the old signature.
  return api.get('/submissions?mine=1');
}
