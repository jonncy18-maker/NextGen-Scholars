// Fetches NGS program data from Supabase and returns it in the same
// shape as scholars-data.js so navigator.jsx needs no structural changes.

import { supabase } from './lib/supabase.js';
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
  const [
    { data: configRows,    error: e1 },
    { data: scholarRows,   error: e2 },
    { data: academicRows,  error: e3 },
    { data: milestoneRows, error: e4 },
    { data: travelRows,    error: e5 },
    { data: budgetRows,    error: e6 },
    { data: expenseRows,   error: e7 },
    { data: alertRows,     error: e8 },
    { data: deadlineRows,  error: e9 },
    { data: actionRows,    error: e10 },
  ] = await Promise.all([
    supabase.from('config').select('*'),
    supabase.from('scholars').select('*'),
    supabase.from('academics').select('*'),
    supabase.from('milestones').select('*'),
    supabase.from('travels').select('*'),
    supabase.from('budgets').select('*'),
    supabase.from('expenses').select('*'),
    supabase.from('alerts').select('*'),
    supabase.from('deadlines').select('*'),
    supabase.from('actions').select('*'),
  ]);

  const firstError = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10;
  if (firstError) throw new Error(firstError.message);

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
        expenses[sem].push({
          id:     e.id,
          item:   e.item,
          amount: num(e.amount),
          qty:    num(e.qty) || 1,
          cat:    e.cat,
          bucket: CAT_TO_BUCKET[e.cat] ?? e.bucket ?? 'college',
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
        status:    s.status.charAt(0).toUpperCase() + s.status.slice(1),
        stage:     s.card_stage,
        year:      s.card_year,
        quote:     s.quote,
        progress:  num(s.card_progress),
        accentKey: s.status === 'paused' ? 'red' : 'gold',
        ...(key !== 'aljane' ? { href: `${key}.html` } : {}),
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
  const { data, error } = await supabase
    .from('expense_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadScholarSubmissions(scholarKey) {
  const { data, error } = await supabase
    .from('expense_submissions')
    .select('*')
    .eq('scholar_key', scholarKey)
    .not('status', 'eq', 'approved')
    .not('status', 'eq', 'resubmitted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
