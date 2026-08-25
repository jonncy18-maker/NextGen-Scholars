// Turning one budgeted monthly amount into dated outflow rows.
//
// Shared deliberately between the client (which previews the dates before the
// mentor approves) and the API route (which re-derives them before writing).
// The server never trusts the client's dates — it recomputes from the same
// schedule object here, so the preview and the write can't drift.

export const WEEKDAYS = [
  { key: 0, label: 'Sunday' },
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
];

export const SCHEDULE_MODES = [
  { key: 'monthly', label: 'Monthly', hint: 'One outflow, on a day you pick' },
  { key: 'weekly', label: 'Weekly', hint: 'Repeats on a weekday, split across the month' },
  { key: 'once', label: 'One-off', hint: 'A single date you choose' },
];

function daysInMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isMonthKey(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
}

// Every date in `month` this schedule lands on, ascending. Returns [] for a
// schedule that can't be resolved — the caller treats that as "not ready",
// never as "no money".
export function occurrences(month, schedule) {
  if (!isMonthKey(month) || !schedule) return [];
  const [y, m] = month.split('-').map(Number);
  const last = daysInMonth(month);

  if (schedule.mode === 'once') {
    // A one-off may legitimately fall outside the budgeted month (an August
    // plan paid on 1 September), so this one is taken as given rather than
    // clamped — only its shape is checked.
    return /^\d{4}-\d{2}-\d{2}$/.test(String(schedule.date || '')) ? [schedule.date] : [];
  }

  if (schedule.mode === 'monthly') {
    const day = Number(schedule.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) return [];
    // Clamp rather than roll into the next month: "the 31st" in a 30-day
    // month means the last day, not the 1st of the month after.
    return [iso(y, m, Math.min(day, last))];
  }

  if (schedule.mode === 'weekly') {
    const wd = Number(schedule.weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) return [];
    const out = [];
    for (let d = 1; d <= last; d++) {
      if (new Date(y, m - 1, d).getDay() === wd) out.push(iso(y, m, d));
    }
    return out;
  }

  return [];
}

// Split a monthly total across its occurrences so the parts still sum to the
// whole. Rounding down and handing the remainder to the last row keeps the
// month's total EXACTLY equal to the budgeted figure — important here because
// these rows replace the lump-sum allowance expense, and a few pesos of drift
// per category would show up as the program and her budget disagreeing.
export function splitAmount(totalPhp, count) {
  const total = Math.round(Number(totalPhp) || 0);
  if (count <= 0) return [];
  if (count === 1) return [total];
  const base = Math.floor(total / count);
  const parts = Array(count).fill(base);
  parts[count - 1] = total - base * (count - 1);
  return parts;
}

// The dated rows one budget line becomes. `line` carries the amount and the
// schedule; the caller supplies whatever else an expense row needs.
export function expandLine(month, line) {
  const dates = occurrences(month, line?.schedule);
  if (!dates.length) return [];
  const parts = splitAmount(line.amount_php, dates.length);
  return dates.map((date, i) => ({ date, amount: parts[i] }));
}
