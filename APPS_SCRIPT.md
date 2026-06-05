# Apps Script — doPost Handler Reference

The navigator and scholar expense entry page write back to Google Sheets via a
deployed Apps Script web app. The URL is set in `src/sheets-writer.js` → `WEB_APP_URL`.

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
| `Config` | `key`, `value` — see Config sheet keys below |
| `Log` | `ts`, `scholar`, `type`, `detail` (optional — sheet may not exist) |

Column order no longer matters for `addExpense` — it maps values by header name. If your column names differ, update `fieldMap` keys in the script above.

---

## Config sheet — required keys

The `Config` sheet is read by the frontend on every page load. It must have two columns: `key` and `value`.

| key | value | Notes |
|---|---|---|
| `exchangeRate` | `56` | PHP per USD |
| `password` | `ngs2026` | Navigator (mentor) lock password. Move out of source code — only lives here. |
| `claire_password` | `Claire2028` | Scholar expense entry password for Claire |
| `april_password` | `April2032` | Scholar expense entry password for April |
| `lastUpdated` | `2026-06-05` | Display only |

**Important:** Lock this sheet so only the mentor (spreadsheet owner) can edit it. Go to
**Data → Protect sheets and ranges**, select the Config sheet, and restrict editing to yourself.

Scholar passwords are fetched client-side for the UX gate (showing the form), and are also
validated server-side in `addExpense` before any row is written to the Expenses sheet. Even if
someone bypasses the client check, the Apps Script rejects the write.

---

## Scholar password validation in addExpense

The `addExpense` action now accepts an optional `password` field. The Apps Script reads the
expected password from the Config sheet and rejects the write if it doesn't match.

Update the `addExpense` block in `doPost` to add this check:

```javascript
} else if (payload.action === 'addExpense') {
  // Validate scholar password before writing
  var cfgSheet = ss.getSheetByName('Config');
  var cfgRows  = cfgSheet.getDataRange().getValues();
  var cfgMap   = {};
  for (var c = 1; c < cfgRows.length; c++) {
    cfgMap[cfgRows[c][0]] = cfgRows[c][1];
  }
  var expectedPw = cfgMap[payload.scholar + '_password'];
  if (expectedPw && payload.password !== String(expectedPw)) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ... rest of addExpense logic unchanged
```

---

## Next steps checklist

- [ ] Add scholar password rows to Config sheet (`claire_password`, `april_password`)
- [ ] Lock the Config sheet (Data → Protect sheets and ranges → restrict to owner)
- [ ] Update `doPost` to validate `password` in `addExpense` (see block above)
- [ ] Deploy a new version and confirm the URL is unchanged  
      (if it changed, update `WEB_APP_URL` in `src/sheets-writer.js`)
- [ ] Test scholar entry page → verify expense appears in Expenses sheet
- [ ] Test wrong password on entry page → verify Apps Script rejects the write
- [ ] Test **Add Expense** in the navigator → verify new row appears in the Expenses sheet
- [ ] Test **Actions checklist** toggle → verify `done` column flips in the Actions sheet
- [ ] Test **Mark Sent** → verify `sent` column updates in the Expenses sheet
