// Shared FX rate utility — used by navigator and profile pages.
// Rate is PHP per 1 USD (e.g. 56 means $1 = ₱56).
// Mode and rate are persisted in localStorage so the setting carries across pages.

const LS_MODE = 'ngs_fx_mode';
const LS_RATE = 'ngs_fx_rate';
const LS_TS   = 'ngs_fx_ts';
const CACHE_TTL = 3_600_000; // 1 hour

export const DEFAULT_RATE = 56;

export function storedMode() {
  return localStorage.getItem(LS_MODE) || 'manual';
}

export function storedRate() {
  const v = parseFloat(localStorage.getItem(LS_RATE));
  return isNaN(v) ? DEFAULT_RATE : v;
}

export function persistFx(mode, rate) {
  localStorage.setItem(LS_MODE, mode);
  localStorage.setItem(LS_RATE, String(rate));
}

export async function fetchMarketRate() {
  const ts = parseInt(localStorage.getItem(LS_TS) || '0', 10);
  const cached = parseFloat(localStorage.getItem(LS_RATE));
  if (
    Date.now() - ts < CACHE_TTL &&
    !isNaN(cached) &&
    localStorage.getItem(LS_MODE) === 'market'
  ) {
    return cached;
  }
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
  );
  if (!res.ok) throw new Error('FX API error');
  const data = await res.json();
  const rate = data?.usd?.php;
  if (!rate) throw new Error('PHP rate missing in FX response');
  localStorage.setItem(LS_RATE, String(rate));
  localStorage.setItem(LS_TS, String(Date.now()));
  return rate;
}
