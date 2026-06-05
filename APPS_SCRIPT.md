# Apps Script — doPost Handler Reference

The navigator writes back to Google Sheets via a deployed Apps Script web app.
The URL is set in `src/sheets-writer.js` → `WEB_APP_URL`.

Requests are fire-and-forget (`mode: 'no-cors'`) JSON POST.  
The body arrives as a raw JSON string in `e.postData.contents`.

---

## How to deploy / redeploy

1. Open the bound Apps Script in your Google Sheet  
   (**Extensions → Apps Script**)
2. Replace / update the `doPost` function below
3. **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**
4. Copy the new web app URL if it changed and update `WEB_APP_URL` in `src/sheets-writer.js`

> Execute as: **Me** · Who has access: **Anyone**

---

## Full doPost function

Paste this as the complete `doPost` function in your Apps Script project.

```javascript
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (_) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'bad JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── markSent ──────────────────────────────────────────────────────────────
  // Marks an expense row as sent (sets the "Sent" column to "Yes").
  // Payload: { action, id, scholar }
  if (payload.action === 'markSent') {
    var expSheet = ss.getSheetByName('Expenses');
    var expData  = expSheet.getDataRange().getValues();
    var expHdrs  = expData[0];
    var idCol    = expHdrs.indexOf('id');
    var sentCol  = expHdrs.indexOf('sent');
    for (var i = 1; i < expData.length; i++) {
      if (String(expData[i][idCol]) === String(payload.id)) {
        expSheet.getRange(i + 1, sentCol + 1).setValue('Yes');
        break;
      }
    }

  // ── addExpense ────────────────────────────────────────────────────────────
  // Appends a new expense row to the Expenses sheet.
  // Payload: { action, scholar, sem, item, cat, amount, qty, date, avb, sent, vendor }
  // Uses header-based column insertion so it is robust to any column order.
  } else if (payload.action === 'addExpense') {
    var addSheet = ss.getSheetByName('Expenses');
    var addHdrs  = addSheet.getDataRange().getValues()[0];
    var newRow   = new Array(addHdrs.length).fill('');
    var fieldMap = {
      id:      'exp_' + Date.now(),
      scholar: payload.scholar,
      sem:     payload.sem,
      item:    payload.item,
      cat:     payload.cat,
      amount:  Number(payload.amount) || 0,
      qty:     Number(payload.qty)    || 1,
      date:    payload.date,
      avb:     payload.avb,
      sent:    payload.sent === 'Yes' ? 'Yes' : 'No',
      vendor:  payload.vendor || '',
    };
    addHdrs.forEach(function(h, i) {
      if (fieldMap.hasOwnProperty(h)) newRow[i] = fieldMap[h];
    });
    addSheet.appendRow(newRow);

  // ── toggleAction ──────────────────────────────────────────────────────────
  // Flips the done column on an Actions row identified by id.
  // Payload: { action, id, done }  (done is boolean)
  } else if (payload.action === 'toggleAction') {
    var actSheet = ss.getSheetByName('Actions');
    var actData  = actSheet.getDataRange().getValues();
    var actHdrs  = actData[0];
    var aIdCol   = actHdrs.indexOf('id');
    var doneCol  = actHdrs.indexOf('done');
    for (var j = 1; j < actData.length; j++) {
      if (String(actData[j][aIdCol]) === String(payload.id)) {
        actSheet.getRange(j + 1, doneCol + 1).setValue(payload.done === true || payload.done === 'true');
        break;
      }
    }

  // ── logUpdate ─────────────────────────────────────────────────────────────
  // Appends a free-text log entry. Kept for future use.
  // Payload: { action, ts, scholar, type, detail }
  } else if (payload.action === 'logUpdate') {
    var logSheet = ss.getSheetByName('Log');
    if (logSheet) {
      logSheet.appendRow([payload.ts, payload.scholar, payload.type, payload.detail]);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## Sheet column assumptions

| Sheet | Expected columns |
|---|---|
| `Expenses` | `id`, `scholar`, `sem`, `item`, `cat`, `amount`, `qty`, `date`, `avb`, `sent`, `vendor` (any order — the script maps by header name) |
| `Actions` | `id`, `done` (plus any others) |
| `Log` | `ts`, `scholar`, `type`, `detail` (optional — sheet may not exist) |

Column order no longer matters for `addExpense` — it maps values by header name. If your column names differ, update `fieldMap` keys in the script above.

---

## Next steps checklist

- [ ] Replace `doPost` in Apps Script with the function above
- [ ] Deploy a new version and confirm the URL is unchanged  
      (if it changed, update `WEB_APP_URL` in `src/sheets-writer.js`)
- [ ] Test **Add Expense** in the navigator → verify new row appears in the Expenses sheet
- [ ] Test **Actions checklist** toggle → verify `done` column flips in the Actions sheet
- [ ] Test **Mark Sent** → verify `sent` column updates in the Expenses sheet
