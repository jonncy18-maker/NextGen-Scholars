// Replace the empty string with your Apps Script Web App URL after deploying doPost.
// Apps Script → Deploy → New deployment → Web app
//   Execute as: Me  |  Who has access: Anyone with the link
// Paste the generated URL here, then hard-refresh the navigator.
export const WEB_APP_URL = '';

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
