'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { getToken } from '../lib/auth-client.js';

// TEMPORARY — see app/api/luna-compare/route.js. Mentor-only (the API call
// carries the signed-in mentor's token and the route requires the mentor role).
// Reads one receipt or a typed description with Claude and with Luna and shows
// both extractions side by side. Nothing is saved.

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_BYTES = 3.3 * 1024 * 1024; // keeps the base64 body under the host's request limit

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const total = (items) =>
  items.reduce((s, i) => s + (Number(i.amount) || 0) * (Number(i.qty) || 1), 0);
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function readFile(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () =>
      resolve({ name: f.name, base64: String(r.result).split(',')[1], mime: f.type });
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(f);
  });
}

function Side({ title, side, other }) {
  const otherByItem = new Map((other?.ok ? other.items : []).map((i) => [norm(i.item), i]));
  return (
    <div
      style={{ border: '1px solid #ccd3dc', borderRadius: 6, padding: '10px 12px', minWidth: 0 }}
    >
      <h2 style={{ fontSize: '1rem', margin: '0 0 6px' }}>
        {title}{' '}
        <span style={{ fontWeight: 400, color: '#666', fontSize: 13 }}>
          ({(side.ms / 1000).toFixed(1)}s)
        </span>
      </h2>
      {!side.ok ? (
        <p style={{ color: '#b3321f', overflowWrap: 'anywhere' }}>{side.error}</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            {side.items.length} line{side.items.length === 1 ? '' : 's'} · total{' '}
            {peso(total(side.items))}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
              <thead>
                <tr>
                  {['Item', 'Amount', 'Qty', 'Category', 'Date', 'Vendor'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '3px 6px',
                        borderBottom: '1px solid #ddd',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {side.items.map((i, k) => {
                  const o = otherByItem.get(norm(i.item));
                  const diff = (f) => o && String(o[f]) !== String(i[f]);
                  const cell = (f, v) => (
                    <td
                      style={{
                        padding: '3px 6px',
                        verticalAlign: 'top',
                        background: diff(f) ? '#fff4d6' : undefined,
                      }}
                    >
                      {v}
                    </td>
                  );
                  return (
                    <tr key={k}>
                      {cell('item', i.item)}
                      {cell('amount', peso(i.amount))}
                      {cell('qty', i.qty)}
                      {cell('cat', i.cat)}
                      {cell('date', i.date)}
                      {cell('vendor', i.vendor)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function LunaCompare() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  // What the page can tell about the sign-in, so a failure says which step broke.
  const [session, setSession] = useState({ state: 'checking', detail: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      let next;
      try {
        const token = await getToken();
        if (!token) {
          next = {
            state: 'bad',
            detail:
              'The sign-in service did not give this page a token. You may be signed out, or the session is not reaching this page.',
          };
        } else {
          const me = await api.get('/me');
          next =
            me?.role === 'mentor'
              ? { state: 'ok', detail: 'Signed in as the mentor.' }
              : {
                  state: 'bad',
                  detail: `Signed in, but as ${me?.role || 'an unknown role'}${me?.scholarKey ? ` (${me.scholarKey})` : ''}, not the mentor.`,
                };
        }
      } catch (e) {
        next = {
          state: 'bad',
          detail:
            `A token was found, but the server rejected it: ${e.status || ''} ${e.message}`.trim(),
        };
      }
      if (alive) setSession(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function pick(e) {
    const f = e.target.files?.[0];
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_MIME.includes(f.type)) {
      setStatus(`Unsupported file type: ${f.type || 'unknown'}.`);
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setStatus('That file is over about 3 MB. Use a smaller one.');
      setFile(null);
      return;
    }
    setStatus('');
    setFile(await readFile(f));
  }

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      if (!file && !text.trim())
        throw new Error('Choose a receipt file or type a description first.');
      setStatus('Reading with both models… this can take up to a minute.');
      const data = await api.post('/luna-compare', {
        file: file || undefined,
        text: text.trim() || undefined,
      });
      setResult(data);
      setStatus('Done. Nothing was saved.');
    } catch (e) {
      setStatus(`Stopped${e.status ? ` (${e.status})` : ''}: ${e.message}`);
    }
    setBusy(false);
  }

  const bothOk = result?.claude?.ok && result?.luna?.ok;
  const catDiffs = bothOk
    ? result.claude.items.filter((i) => {
        const o = result.luna.items.find((x) => norm(x.item) === norm(i.item));
        return o && o.cat !== i.cat;
      }).length
    : 0;

  return (
    <div
      style={{
        font: '15px/1.5 system-ui, sans-serif',
        maxWidth: 1000,
        margin: '24px auto',
        padding: '0 16px',
        color: '#1b2430',
      }}
    >
      <h1 style={{ fontSize: '1.3rem' }}>
        Expense ingestion: Claude vs Luna{' '}
        <small style={{ fontWeight: 400 }}>(temporary, mentor-only, read-only)</small>
      </h1>
      <p>
        Upload one real receipt, or type a description the way you would in the console. The app
        extracts the expense lines with Claude (what runs today) and with Luna and shows both.
        Nothing is saved. Cells that differ between the two are highlighted.
      </p>

      <p
        role="status"
        style={{
          margin: '10px 0 0',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 14,
          background:
            session.state === 'ok' ? '#dff3e4' : session.state === 'bad' ? '#fbe3df' : '#eef1f4',
        }}
      >
        {session.state === 'checking' ? 'Checking your sign-in…' : session.detail}
      </p>

      <label htmlFor="receipt" style={{ display: 'block', marginTop: 12, fontWeight: 600 }}>
        Receipt (photo or PDF, about 3 MB or less)
      </label>
      <input id="receipt" type="file" accept={ACCEPTED_MIME.join(',')} onChange={pick} />

      <label htmlFor="desc" style={{ display: 'block', marginTop: 12, fontWeight: 600 }}>
        …or describe the spending
      </label>
      <textarea
        id="desc"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. Claire spent 500 on jeepney fare today, paid 3,500 tuition and 850 for two nursing textbooks"
        style={{
          font: 'inherit',
          width: '100%',
          maxWidth: 560,
          padding: 6,
          boxSizing: 'border-box',
        }}
      />

      <div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          style={{ font: 'inherit', padding: '8px 16px', marginTop: 14, cursor: 'pointer' }}
        >
          Compare Claude and Luna
        </button>
      </div>
      <p aria-live="polite" style={{ color: '#555' }}>
        {status}
      </p>

      {result && (
        <>
          {bothOk && (
            <p
              style={{
                background: catDiffs ? '#fff4d6' : '#dff3e4',
                padding: '8px 12px',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {result.claude.items.length === result.luna.items.length
                ? 'Same number of lines. '
                : `Different number of lines (${result.claude.items.length} vs ${result.luna.items.length}). `}
              {peso(total(result.claude.items)) === peso(total(result.luna.items))
                ? 'Same total. '
                : `Totals differ (${peso(total(result.claude.items))} vs ${peso(total(result.luna.items))}). `}
              {catDiffs
                ? `${catDiffs} line${catDiffs === 1 ? '' : 's'} got a different category.`
                : 'Same categories.'}
            </p>
          )}
          {result.claude.ok && !result.luna.ok && (
            <p
              style={{
                background: '#fff4d6',
                padding: '8px 12px',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              Luna did not return lines. Its column says why (a missing key, a timeout, or an error
              from OpenAI).
            </p>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: 12,
            }}
          >
            <Side title="Claude (today)" side={result.claude} other={result.luna} />
            <Side title="Luna" side={result.luna} other={result.claude} />
          </div>
        </>
      )}
    </div>
  );
}
