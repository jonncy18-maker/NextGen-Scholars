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

// ── Scholar living budget (/budget/:scholar) ─────────────────────────────────
// The scholar's own allowance budget with user-defined categories. Separate in
// every way from the mentor's `expenses`/`budgets` — see db/living_budget.sql.

// Accepts one category or an array (used to seed the starter set). The server
// skips names this scholar already has, so calling it twice is safe.
export async function createLivingCategories(scholar, categories) {
  const rows = await api.post('/living/categories', Array.isArray(categories)
    ? { scholar, categories }
    : { scholar, ...categories });
  api.afterWrite();
  return rows;
}

export async function updateLivingCategory(id, fields) {
  const row = await api.patch(`/living/categories/${id}`, fields);
  api.afterWrite();
  return row;
}

// Archives rather than destroys when the category already has plan history;
// the response says which happened ({ deleted, archived }).
export async function deleteLivingCategory(id) {
  const res = await api.del(`/living/categories/${id}`);
  api.afterWrite();
  return res;
}

// Upsert on (category_id, month) — safe to call repeatedly as she revises.
export async function setLivingPlan({ month, category_id, planned_php, note }) {
  const row = await api.put('/living/plan', { month, category_id, planned_php, note });
  api.afterWrite();
  return row;
}
