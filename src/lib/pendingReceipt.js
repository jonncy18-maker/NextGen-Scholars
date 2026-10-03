// One-shot hand-off of a freshly snapped receipt from Home to the Money page.
//
// Home's "Snap receipt" button opens the phone camera, then navigates to
// /entry. Next's client-side navigation keeps this module alive, so the photo
// can ride along in memory instead of in a URL or storage (a phone photo is far
// too big for sessionStorage). ScholarIngestPanel — the SAME receipt flow the
// Money page already has — takes it on mount and runs its normal extract, which
// ends in the review-before-submit card. Nothing is saved from here.
//
// A hard reload on /entry loses the pending photo; the panel then just shows
// its usual drop zone.

let pending = null;

export function setPendingReceipt(payload) {
  pending = payload;
}

// Returns { name, base64, mime } once, then null.
export function takePendingReceipt() {
  const p = pending;
  pending = null;
  return p;
}

const MAX_EDGE = 1600;

// File -> { name, base64, mime }. Phone-camera JPEGs are 3–8 MB; the extract
// call posts base64 JSON, which would blow past Vercel's ~4.5 MB body limit, so
// images are downscaled (long edge 1600px, JPEG 0.85 — still plenty for a
// receipt). Non-images and any decode failure fall back to the original bytes.
export async function fileToReceiptPayload(file) {
  const raw = await readAsDataUrl(file);
  const original = { name: file.name, base64: raw.split(',')[1], mime: file.type };
  if (!file.type.startsWith('image/') || typeof document === 'undefined') return original;
  try {
    const img = await loadImage(raw);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', 0.85);
    return {
      name: file.name.replace(/\.\w+$/, '') + '.jpg',
      base64: out.split(',')[1],
      mime: 'image/jpeg',
    };
  } catch {
    return original;
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
