// Replace the empty string with your Apps Script Web App URL after deploying doPost.
// Apps Script → Deploy → New deployment → Web app
//   Execute as: Me  |  Who has access: Anyone with the link
// Paste the generated URL here, then hard-refresh the navigator.
export const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzOrJyFROMg2HQGjAVYF84VjeN7Q_ZOpX6b3tNh-dP3HcpeH3tekYrPJI3T9lnWqaZd/exec';

// Fire-and-forget POST to the Apps Script web app.
// Apps Script blocks CORS on the response, so we use no-cors (can't read the reply).
// UI updates optimistically; the write still goes through.
export function writeToSheets(payload) {
  if (!WEB_APP_URL) return;
  fetch(WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    mode: 'no-cors',
  }).catch(() => {});
}

// Convenience wrappers for each write action.

export function writeSent(id, scholar) {
  writeToSheets({ action: 'markSent', id: String(id), scholar });
}

export function writeExpense(scholar, exp) {
  writeToSheets({
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
