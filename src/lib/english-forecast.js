// Pure calculation helpers for English hours forecasting and scenario modeling.
// No React or Supabase dependencies — safe to import anywhere.

function r2(n) { return Math.round(n * 100) / 100; }

/**
 * Compute the live forecast for a (period, sessions) pair.
 * Returns an object shaped for english_forecasts upsert, or null if period is missing.
 */
export function calcForecast(period, sessions) {
  if (!period) return null;

  const now         = new Date();
  const periodStart = new Date(period.start_date + 'T00:00:00');
  const periodEnd   = new Date(period.end_date   + 'T00:00:00');

  const totalDays      = Math.max(1, (periodEnd - periodStart) / 86400000);
  const elapsedDays    = Math.max(0, Math.min(totalDays, (now - periodStart) / 86400000));
  const weeksRemaining = Math.max(0, (periodEnd - now) / (7 * 86400000));

  const totalMinutes = (sessions || []).reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const actualHours  = totalMinutes / 60;

  const actualByCat = {};
  (sessions || []).forEach(s => {
    const cat = s.activity_type || 'Other';
    actualByCat[cat] = r2((actualByCat[cat] || 0) + (s.duration_minutes || 0) / 60);
  });

  const expectedHours = (period.hour_goal || 0) * (elapsedDays / totalDays);

  // Rolling 4-week pace
  const cutoff     = new Date(now.getTime() - 28 * 86400000);
  const recentMins = (sessions || [])
    .filter(s => new Date(s.date + 'T00:00:00') >= cutoff)
    .reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const paceHrsPerWeek = recentMins / 60 / 4;

  const projectedTotal = actualHours + paceHrsPerWeek * weeksRemaining;
  const gapVsGoal      = projectedTotal - (period.hour_goal || 0);

  const ratio  = expectedHours > 0 ? actualHours / expectedHours : 1;
  const status = ratio >= 0.9 ? 'on_track' : ratio >= 0.7 ? 'behind' : 'at_risk';

  return {
    scholar:           period.scholar,
    period_id:         period.id,
    actual_hours:      r2(actualHours),
    actual_by_cat:     actualByCat,
    expected_hours:    r2(expectedHours),
    pace_hrs_per_week: r2(paceHrsPerWeek),
    projected_total:   r2(projectedTotal),
    gap_vs_goal:       r2(gapVsGoal),
    weeks_remaining:   Math.round(weeksRemaining * 10) / 10,
    status,
    updated_at:        new Date().toISOString(),
  };
}

/**
 * Compute projected outcomes for a scenario on top of the baseline forecast.
 * Returns { projected_total, gap_vs_goal, projected_completion_date }.
 */
export function calcScenarioOutcomes(scenario, period, forecast) {
  if (!scenario || !period || !forecast) return {};

  const weeksRemaining = forecast.weeks_remaining || 0;
  const actualHours    = forecast.actual_hours    || 0;
  const scenarioPace   = (forecast.pace_hrs_per_week || 0) + (scenario.additional_hrs_per_week || 0);

  const projectedTotal = actualHours + scenarioPace * weeksRemaining;
  const gapVsGoal      = projectedTotal - (period.hour_goal || 0);

  let projectedCompletionDate = null;
  if (scenarioPace > 0 && actualHours < (period.hour_goal || 0)) {
    const hoursNeeded = (period.hour_goal || 0) - actualHours;
    const weeksToGoal = hoursNeeded / scenarioPace;
    const ms = Date.now() + weeksToGoal * 7 * 86400000;
    projectedCompletionDate = new Date(ms).toISOString().slice(0, 10);
  }

  return {
    projected_total:           r2(projectedTotal),
    gap_vs_goal:               r2(gapVsGoal),
    projected_completion_date: projectedCompletionDate,
  };
}
