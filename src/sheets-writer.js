// Apps Script Web App URL. Must be updated here whenever the Apps Script is redeployed
// (each new deployment generates a new URL). Apps Script → Manage deployments → copy URL.
export const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzOrJyFROMg2HQGjAVYF84VjeN7Q_ZOpX6b3tNh-dP3HcpeH3tekYrPJI3T9lnWqaZd/exec';

// POST to the Apps Script web app. Returns the fetch Promise so callers can handle network errors.
// Apps Script blocks CORS on the response (no-cors), so server-side errors are not detectable;
// only network-level failures (no connectivity, DNS) will reject the Promise.
export function writeToSheets(payload) {
  if (!WEB_APP_URL) return Promise.resolve();
  return fetch(WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    mode: 'no-cors',
  });
}

// Convenience wrappers for each write action.

export function writeSent(id, scholar) {
  writeToSheets({ action: 'markSent', id: String(id), scholar });
}

export function writeExpense(scholar, exp) {
  return writeToSheets({
    action: 'addExpense',
    scholar,
    sem:    exp.sem,
    item:   exp.item,
    cat:    exp.cat,
    amount: exp.amount,
    qty:    exp.qty,
    date:   exp.date,
    avb:    exp.avb,
    sent:   exp.sent,
    vendor: exp.vendor || '',
  });
}

export function writeActionToggle(id, done) {
  writeToSheets({ action: 'toggleAction', id: String(id), done });
}

export function writeLog(entry) {
  writeToSheets({
    action: 'logUpdate',
    ts:      entry.ts,
    scholar: entry.scholar,
    type:    entry.type,
    detail:  entry.detail,
  });
}

export function writeSemester(scholar, sem) {
  writeToSheets({ action: 'setSemester', scholar, sem });
}
