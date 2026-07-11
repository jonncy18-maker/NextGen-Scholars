// Write-back helpers using the Next.js API routes on Neon. Same exported
// names/signatures as the old src/supabase-writer.js it replaces, so call
// sites that only import from here need nothing but an import-path swap.
// All functions return Promises and throw (via api.js's ApiError) on failure.

import { api } from './lib/api.js';

export async function writeExpense(scholar, exp) {
  const row = await api.post('/expenses', { scholar, exp });
  api.afterWrite();
  return row;
}

export async function writeSent(id, _scholar) {
  await api.patch(`/expenses/${id}`, { sent: 'Yes' });
  api.afterWrite();
}

export async function writeActionToggle(id, done) {
  await api.patch(`/actions/${id}`, { done });
  api.afterWrite();
}

export async function writeSemester(scholar, sem) {
  await api.patch(`/scholars/${scholar}`, { sem });
  api.afterWrite();
}

export async function writeActivityLog({ scholar, type, expense_id, expense_data, changes }) {
  await api.post('/activity', { scholar, type, expense_id, expense_data, changes });
  api.afterWrite();
}

export async function updateExpense(id, fields) {
  await api.patch(`/expenses/${id}`, fields);
  api.afterWrite();
}

export async function deleteExpense(id) {
  await api.del(`/expenses/${id}`);
  api.afterWrite();
}

export async function markActivityRead(ids) {
  await api.patch('/activity/read', { ids });
  api.afterWrite();
}

// ── Expense submission approval workflow ──────────────────────────────────

export async function writeSubmission(scholar, expenseData) {
  const row = await api.post('/submissions', { scholar, expenseData });
  api.afterWrite();
  return row;
}

export async function approveSubmission(submissionId, _expenseData, _scholarKey) {
  // The server looks up the submission row itself and runs the insert +
  // status-update as one Neon transaction — expenseData/scholarKey are no
  // longer needed client-side, kept as unused params for call-site parity.
  await api.post(`/submissions/${submissionId}/approve`);
  api.afterWrite();
}

export async function rejectSubmission(submissionId, comment) {
  await api.post(`/submissions/${submissionId}/reject`, { comment });
  api.afterWrite();
}

export async function resubmitExpense(originalId, scholar, expenseData) {
  const row = await api.post('/submissions', { scholar, expenseData, resubmitOf: originalId });
  api.afterWrite();
  return row;
}

export async function markSubmissionReadByScholar(id) {
  await api.patch(`/submissions/${id}/read`);
  api.afterWrite();
}

// Edit a still-pending submission's expense_data in place (no new row, unlike
// resubmitExpense which supersedes a rejected one). Server rejects the update
// unless the row is still 'pending' and owned by the caller.
export async function updateSubmission(id, expenseData) {
  const row = await api.patch(`/submissions/${id}`, { expenseData });
  api.afterWrite();
  return row;
}

// ── English forecasts + scenarios ─────────────────────────────────────────────

export async function upsertEnglishForecast(forecastData) {
  await api.put('/english/forecasts', forecastData);
  api.afterWrite();
}

export async function saveEnglishScenario(scenario) {
  const row = await api.post('/english/scenarios', scenario);
  api.afterWrite();
  return row;
}

export async function deleteEnglishScenario(id) {
  await api.del(`/english/scenarios/${id}`);
  api.afterWrite();
}

export async function updatePeriodWeeklyTargets(periodId, weeklyTargetHours, weeklyTargetByCategory) {
  await api.patch(`/english/periods/${periodId}`, {
    weekly_target_hours: weeklyTargetHours,
    weekly_target_by_category: weeklyTargetByCategory,
  });
  api.afterWrite();
}
