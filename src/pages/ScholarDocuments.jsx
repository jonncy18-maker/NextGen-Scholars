import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, SUPABASE_URL } from '../lib/supabase.js';
import { SEMESTER_OPTIONS } from '../constants.js';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';

async function loadConfig() {
  try {
    const { data } = await supabase.from('config').select('key, value');
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    return map;
  } catch {
    return {};
  }
}

const DOC_TYPES = ['receipt', 'transcript', 'visa', 'oet', 'other'];
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

const TYPE_STYLE = {
  receipt:    { bg: '#EBF5EB', color: '#2F7D55' },
  transcript: { bg: '#EBF0FB', color: '#2C5AA0' },
  visa:       { bg: '#F5EBEB', color: '#B11B2A' },
  oet:        { bg: '#FEF8E8', color: '#B57E1E' },
  other:      { bg: '#F2EDE2', color: '#6B6E7A' },
};

const STATUS_MAP = {
  pending_review: { label: 'Pending review', cls: 'doc-status-pending' },
  reviewed:       { label: 'Reviewed',        cls: 'doc-status-reviewed' },
  linked:         { label: 'Linked',          cls: 'doc-status-linked' },
};

const FALLBACK = {
  claire:     { name: 'Claire',     homeHref: '/home/claire',     sem: 'Y2S1' },
  april:      { name: 'April',      homeHref: '/home/april',      sem: 'TG11S1' },
  janndilyne: { name: 'Janndilyne', homeHref: '/home/janndilyne', sem: 'Y1S1' },
};

function TypeBadge({ type }) {
  const { bg, color } = TYPE_STYLE[type] || TYPE_STYLE.other;
  return (
    <span className="doc-type-badge" style={{ background: bg, color }}>
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'doc-status-pending' };
  return <span className={`doc-status-badge ${cls}`}>{label}</span>;
}

function DocsLockGate({ scholarKey, name, onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(false);
  const [config, setConfig]     = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { loadConfig().then(setConfig); }, []);
  useEffect(() => { if (config) inputRef.current?.focus(); }, [config]);

  function unlock(e) {
    e.preventDefault();
    const expected = config?.[`${scholarKey}_password`];
    if (expected && password === expected) {
      sessionStorage.setItem('ngs_auth_scholar', scholarKey);
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <div className="el-lock" data-scholar={scholarKey}>
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Welcome, <em>{name}</em></h1>
        <p className="el-sub">Enter your password to access your documents</p>
        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={unlock} autoComplete="off">
          <div className="el-field">
            <label className="el-label" htmlFor="docs-pw">Password</label>
            <input
              id="docs-pw"
              ref={inputRef}
              className="el-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              disabled={!config}
              autoComplete="current-password"
            />
          </div>
          <div className={`el-err${error ? ' show' : ''}`}>Incorrect password — try again.</div>
          <button type="submit" disabled={!config || !password} className="el-btn">
            {config ? `Continue as ${name} →` : 'Loading…'}
          </button>
        </form>
        <Link to="/" className="el-back">← Back to NextGen Scholars</Link>
      </div>
    </div>
  );
}

export function ScholarDocuments({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;
  const [authed, setAuthed]         = useState(false);
  const [name, setName]             = useState(fallback.name);
  const [currentSem, setCurrentSem] = useState(fallback.sem);
  const [docs, setDocs]             = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [loadError, setLoadError]   = useState(null);

  // Upload modal state
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [upFile, setUpFile]           = useState(null);
  const [upType, setUpType]           = useState('receipt');
  const [upSem, setUpSem]             = useState(fallback.sem);
  const [upNotes, setUpNotes]         = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Auto-auth if already authenticated via session (e.g. coming from /entry portal).
  useEffect(() => {
    if (sessionStorage.getItem('ngs_auth_scholar') === scholarKey) setAuthed(true);
  }, [scholarKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scholarRes, docsRes] = await Promise.all([
          supabase.from('scholars').select('first_name, current_sem').eq('scholar_key', scholarKey).limit(1),
          supabase.from('documents').select('*').eq('scholar', scholarKey).order('uploaded_at', { ascending: false }),
        ]);
        if (cancelled) return;
        const row = scholarRes.data?.[0];
        if (row?.first_name) setName(row.first_name);
        if (row?.current_sem) { setCurrentSem(row.current_sem); setUpSem(row.current_sem); }
        if (docsRes.error) throw docsRes.error;
        setDocs(docsRes.data ?? []);
      } catch (err) {
        if (!cancelled) { setLoadError(err.message); setDocs([]); }
      }
    }
    load();

    const ch = supabase.channel(`scholar_docs_${scholarKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents', filter: `scholar=eq.${scholarKey}` },
        payload => setDocs(prev => prev ? [payload.new, ...prev] : [payload.new]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents', filter: `scholar=eq.${scholarKey}` },
        payload => setDocs(prev => prev ? prev.map(d => d.id === payload.new.id ? payload.new : d) : prev))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documents', filter: `scholar=eq.${scholarKey}` },
        payload => setDocs(prev => prev ? prev.filter(d => d.id !== payload.old.id) : prev))
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [scholarKey]);

  function onFileInput(e) {
    const f = e.target.files?.[0];
    if (f) setUpFile({ name: f.name, blob: f, mime: f.type });
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!upFile) { setUploadError('Please select a file.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(upFile.blob);
      });

      const driveRes = await fetch(`${SUPABASE_URL}/functions/v1/drive-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          scholar_key: scholarKey,
          filename: upFile.name,
          mimeType: upFile.mime,
          base64,
        }),
      });
      const driveData = await driveRes.json();
      if (!driveRes.ok) throw new Error(driveData.error || 'Upload failed.');

      const { error: dbErr } = await supabase.from('documents').insert({
        scholar: scholarKey,
        filename: upFile.name,
        storage_path: driveData.fileId,
        doc_type: upType,
        sem: upSem || null,
        notes: upNotes || null,
        status: 'pending_review',
      });
      if (dbErr) throw new Error(`DB: ${dbErr.message}`);

      setUpFile(null);
      setUpNotes('');
      setUploadOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function openModal() {
    setUpFile(null);
    setUpType('receipt');
    setUpSem(currentSem);
    setUpNotes('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadOpen(true);
  }

  if (!authed) {
    return <DocsLockGate scholarKey={scholarKey} name={name} onUnlock={() => setAuthed(true)} />;
  }

  const filtered = (docs ?? []).filter(d => filterType === 'all' || d.doc_type === filterType);
  const total = (docs ?? []).length;

  return (
    <div className="sp-page">
      <div className="sp">
        <header className="sp-head">
          <div className="sp-track">
            <span className="sp-track-dot" />
            NextGen Nurses
            <span className="sp-track-sep">·</span>
            NGN
          </div>
          <p className="sp-greet-kicker">{name}</p>
          <h1 className="sp-greet-name">Documents.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">Files &amp; records</span>
            <Link to={fallback.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        </header>

        <section className="sp-section">
          {docs === null ? (
            <div className="sd-loading">Loading documents…</div>
          ) : (
            <>
              <div className="sd-header">
                <span className="sd-count">{total} file{total !== 1 ? 's' : ''} on record</span>
                <div className="sd-header-actions">
                  <select
                    className="docs-filter-sel"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                  >
                    <option value="all">All types</option>
                    {DOC_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <button className="docs-upload-trigger" onClick={openModal}>
                    Upload ↑
                  </button>
                </div>
              </div>

              {loadError && (
                <p className="docs-load-error">Could not load documents: {loadError}</p>
              )}

              {filtered.length === 0 ? (
                <div className="docs-empty">
                  {total === 0
                    ? 'No documents on file yet. Tap Upload ↑ to add receipts, transcripts, or other files.'
                    : 'No documents match the current filter.'}
                </div>
              ) : (
                <div className="docs-list">
                  {filtered.map(doc => (
                    <div key={doc.id} className={`docs-row docs-row-${doc.status}`}>
                      <div className="docs-row-top">
                        <span className="docs-filename">{doc.filename}</span>
                        <TypeBadge type={doc.doc_type} />
                        {doc.sem && <span className="docs-sem-chip">{doc.sem}</span>}
                        <StatusBadge status={doc.status} />
                        <span className="docs-date">
                          {doc.uploaded_at ? doc.uploaded_at.slice(0, 10) : ''}
                        </span>
                      </div>
                      {doc.notes && <div className="docs-notes">{doc.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <PublicAskWidget />

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
          <Link to="/" className="sp-home-link">← Home</Link>
        </footer>
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="docs-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setUploadOpen(false); }}>
          <form className="docs-modal" onSubmit={handleUpload}>
            <div className="docs-modal-header">
              <h3 className="docs-modal-title">Upload document</h3>
              <button type="button" className="docs-modal-close" onClick={() => setUploadOpen(false)}>✕</button>
            </div>

            <label className="docs-field-label">Document type
              <select className="docs-field-input" value={upType} onChange={e => setUpType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </label>

            <label className="docs-field-label">Semester
              <select className="docs-field-input" value={upSem} onChange={e => setUpSem(e.target.value)}>
                {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label className="docs-field-label">File
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="docs-field-file"
                onChange={onFileInput}
                required
              />
            </label>
            {upFile && <p className="docs-file-selected">{upFile.name}</p>}

            <label className="docs-field-label">Notes (optional)
              <input
                type="text"
                className="docs-field-input"
                value={upNotes}
                onChange={e => setUpNotes(e.target.value)}
                placeholder="e.g. Semester 1 tuition receipt"
              />
            </label>

            {uploadError && <p className="docs-upload-error">{uploadError}</p>}

            <div className="docs-modal-footer">
              <button type="submit" className="docs-submit-btn" disabled={uploading || !upFile}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" className="docs-cancel-btn" onClick={() => setUploadOpen(false)} disabled={uploading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
