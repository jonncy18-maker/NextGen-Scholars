// Write-back helpers using Supabase. All functions return Promises and
// throw on error so callers can surface failures in the UI.

import { supabase } from './lib/supabase.js';
import { CAT_TO_BUCKET } from './constants.js';

export async function writeExpense(scholar, exp) {
  const { error } = await supabase.from('expenses').insert({
    id:       exp.id || `${scholar}_${exp.sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    scholar,
    sem:      exp.sem,
    item:     exp.item,
    cat:      exp.cat,
    bucket:   exp.bucket || CAT_TO_BUCKET[exp.cat] || 'college',
    amount:   exp.amount,
    qty:      exp.qty,
    date:     exp.date,
    avb:      exp.avb,
    sent:     exp.sent,
    vendor:   exp.vendor || '',
    group_id: exp.group_id || null,
  });
  if (error) throw error;
}

export async function writeSent(id, _scholar) {
  const { error } = await supabase
    .from('expenses')
    .update({ sent: 'Yes' })
    .eq('id', id);
  if (error) throw error;
}

export async function writeActionToggle(id, done) {
  const { error } = await supabase
    .from('actions')
    .update({ done })
    .eq('id', id);
  if (error) throw error;
}

export async function writeSemester(scholar, sem) {
  const { error } = await supabase
    .from('scholars')
    .update({ current_sem: sem })
    .eq('scholar_key', scholar);
  if (error) throw error;
}

export async function writeActivityLog({ scholar, type, expense_id, expense_data, changes }) {
  const { error } = await supabase.from('activity_log').insert({
    scholar_key:  scholar,
    type,
    expense_id:   expense_id  || null,
    expense_data: expense_data || null,
    changes:      changes      || null,
  });
  if (error) throw error;
}

export async function updateExpense(id, fields) {
  const { error } = await supabase
    .from('expenses')
    .update(fields)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function markActivityRead(ids) {
  const { error } = await supabase
    .from('activity_log')
    .update({ read: true })
    .in('id', ids);
  if (error) throw error;
}

// ── Expense submission approval workflow ──────────────────────────────────

export async function writeSubmission(scholar, expenseData) {
  const { data, error } = await supabase
    .from('expense_submissions')
    .insert({ scholar_key: scholar, expense_data: expenseData, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function approveSubmission(submissionId, expenseData, scholarKey) {
  await writeExpense(scholarKey, expenseData);
  const { error } = await supabase
    .from('expense_submissions')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', submissionId);
  if (error) throw error;
}

export async function rejectSubmission(submissionId, comment) {
  const { error } = await supabase
    .from('expense_submissions')
    .update({ status: 'rejected', rejection_comment: comment || null, reviewed_at: new Date().toISOString() })
    .eq('id', submissionId);
  if (error) throw error;
}

export async function resubmitExpense(originalId, scholar, expenseData) {
  await supabase.from('expense_submissions').update({ status: 'resubmitted' }).eq('id', originalId);
  return writeSubmission(scholar, expenseData);
}

export async function markSubmissionReadByScholar(id) {
  const { error } = await supabase
    .from('expense_submissions')
    .update({ read_by_scholar: true })
    .eq('id', id);
  if (error) throw error;
}

// ── English forecasts + scenarios ─────────────────────────────────────────────

export async function upsertEnglishForecast(forecastData) {
  const { error } = await supabase
    .from('english_forecasts')
    .upsert(forecastData, { onConflict: 'scholar,period_id' });
  if (error) throw error;
}

export async function saveEnglishScenario(scenario) {
  if (scenario.id) {
    const { data, error } = await supabase
      .from('english_scenarios')
      .update({ ...scenario, updated_at: new Date().toISOString() })
      .eq('id', scenario.id)
      .select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('english_scenarios')
    .insert(scenario)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteEnglishScenario(id) {
  const { error } = await supabase.from('english_scenarios').delete().eq('id', id);
  if (error) throw error;
}

export async function updatePeriodWeeklyTargets(periodId, weeklyTargetHours, weeklyTargetByCategory) {
  const { error } = await supabase
    .from('english_periods')
    .update({
      weekly_target_hours:        weeklyTargetHours,
      weekly_target_by_category:  weeklyTargetByCategory,
    })
    .eq('id', periodId);
  if (error) throw error;
}
