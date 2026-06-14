import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';
import { writeExpense } from '../supabase-writer.js';
import { EXPENSE_CATS, SEMESTER_OPTIONS } from '../constants.js';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';
const DOC_TYPES = ['receipt', 'transcript', 'visa', 'oet', 'other'];
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

const TYPE_STYLE = {
  receipt:    { bg: '#EBF5EB', color: '#2F7D55' },
  transcript: { bg: '#EBF0FB', color: '#2C5AA0' },
  visa:       { bg: '#F5EBEB', color: '#B11B2A' },
  oet:        { bg: '#FEF8E8', color: '#B57E1E' },
  other:      { bg: '#F2EDE2', color: '#6B6E7A' },
};

function TypeBadge({ type }) {
  const { bg, color } = TYPE_STYLE[type] || TYPE_STYLE.other;
  return <span className="doc-type-badge" style={{ background: bg, color }}>{type}</span>;
}

function StatusBadge({ status }) {
  const map = { pending_review: ['doc-status-pending', 'pending'], reviewed: ['doc-status-reviewed', 'reviewed'], linked: ['doc-status-linked', 'linked'] };
  const [cls, label] = map[status] || ['doc-status-pending', status];
  return <span className={`doc-status-badge ${cls}`}>{label}</span>;
}

// ── Inline ReviewCard ─────────────────────────────────────────────────────────

function DocReviewCard({ items: initialItems, model, scholar, sem, docId, onDiscard, onConfirmed }) {
  const [items, setItems] = useState(initialItems.map(it => ({ ...it })));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }
  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    if (saving || !items.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(items.map(it => writeExpense(scholar, {
        sem, item: it.item, amount: Number(it.amount),
        qty: Number(it.qty) || 1, cat: it.cat, date: it.date,
        vendor: it.vendor || '', avb: 'Actual', sent: 'No',
      })));
      await supabase.from('documents').update({ status: 'linked' }).eq('id', docId);
      onConfirmed(items.length);
    } catch (err) {
      setSaveError(err.message ?? 'Write failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="doc-review-card">
      <div className="doc-review-header">
        <span className="nai-tier-badge nai-tier3-badge">Tier 3 · Gemini</span>
        <span className="doc-review-title">
          {items.length} expense{items.length !== 1 ? 's' : ''} extracted — review before saving
        </span>
        {model && <span className="doc-review-model">{model}</span>}
      </div>
      <table className="nai-review-table">
        <thead>
          <tr><th>Item</th><th>Amount (₱)</th><th>Qty</th><th>Category</th><th>Date</th><th>Vendor</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td><input className="nai-review-input" value={it.item} onChange={e => updateItem(idx, 'item', e.target.value)} /></td>
              <td>
                <input className="nai-review-input" type="number" min="0" step="0.01"
                  value={it.amount} onChange={e => updateItem(idx, 'amount', e.target.value)} style={{ width: 90 }} />
              </td>
              <td>
                <input className="nai-review-input" type="number" min="1" step="1"
                  value={it.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ width: 50 }} />
              </td>
              <td>
                <select className="nai-review-select" value={it.cat} onChange={e => updateItem(idx, 'cat', e.target.value)}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td>
                <input className="nai-review-input" type="date"
                  value={it.date} onChange={e => updateItem(idx, 'date', e.target.value)} style={{ width: 130 }} />
              </td>
              <td><input className="nai-review-input" value={it.vendor} onChange={e => updateItem(idx, 'vendor', e.target.value)} /></td>
              <td>
                <button type="button" onClick={() => removeItem(idx)} style={{ color: 'var(--ngs-muted)', fontSize: 14, padding: '2px 6px' }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {saveError && <div className="nai-error" style={{ marginBottom: 10 }}>{saveError}</div>}
      <div className="nai-review-actions">
        <button className="nai-confirm-btn" onClick={handleConfirm} disabled={saving || !items.length}>
          {saving ? 'Saving…' : `Confirm & save ${items.length} item${items.length !== 1 ? 's' : ''}`}
        </button>
        <button className="nai-discard-btn" onClick={onDiscard} disabled={saving}>Discard</button>
        <span className="nai-confirm-note">Edits above are applied before saving.</span>
      </div>
    </div>
  );
}

// ── DocumentsSection ──────────────────────────────────────────────────────────

export function DocumentsSection({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();

  const [docs, setDocs]           = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [filterScholar, setFilterScholar] = useState('all');
  const [filterType, setFilterType]       = useState('all');

  // Upload modal
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [upFile, setUpFile]             = useState(null);   // { name, blob, mime }
  const [upScholar, setUpScholar]       = useState(scholarKeys[0] || 'claire');
  const [upType, setUpType]             = useState('receipt');
  const [upSem, setUpSem]               = useState('Y1S1');
  const [upNotes, setUpNotes]           = useState('');
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState(null);
  const fileInputRef = useRef(null);

  // Per-doc extraction state
  const [extracting, setExtracting]     = useState({});
  const [extractError, setExtractError] = useState({});
  const [reviews, setReviews]           = useState({});

  async function loadDocs() {
    setLoadError(null);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) { setLoadError(error.message); return; }
    setDocs(data || []);
  }

  useEffect(() => { loadDocs(); }, []);

  useEffect(() => {
    const ch = supabase.channel('ngs_documents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' },
        payload => setDocs(prev => [payload.new, ...prev]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' },
        payload => setDocs(prev => prev.map(d => d.id === payload.new.id ? payload.new : d)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documents' },
        payload => setDocs(prev => prev.filter(d => d.id !== payload.old.id)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — please log in again.');

      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(upFile.blob);
      });

      const driveRes = await fetch(`${SUPABASE_URL}/functions/v1/drive-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload', filename: upFile.name, mimeType: upFile.mime, base64 }),
      });
      const driveData = await driveRes.json();
      if (!driveRes.ok) throw new Error(driveData.error || 'Drive upload failed.');

      const { error: dbErr } = await supabase.from('documents').insert({
        scholar: upScholar,
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

  async function handleDownload(doc) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('Session expired — please log in again.'); return; }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/drive-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', fileId: doc.storage_path }),
      });
      if (!res.ok) { alert('Download failed.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download error: ${err.message}`);
    }
  }

  async function handleMarkReviewed(doc) {
    await supabase.from('documents').update({ status: 'reviewed' }).eq('id', doc.id);
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`${SUPABASE_URL}/functions/v1/drive-proxy`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', fileId: doc.storage_path }),
        });
      }
    } catch { /* best-effort Drive delete */ }
    await supabase.from('documents').delete().eq('id', doc.id);
  }

  async function handleExtract(doc) {
    setExtracting(prev => ({ ...prev, [doc.id]: true }));
    setExtractError(prev => ({ ...prev, [doc.id]: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — please log in again.');

      const driveRes = await fetch(`${SUPABASE_URL}/functions/v1/drive-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_base64', fileId: doc.storage_path }),
      });
      const driveData = await driveRes.json();
      if (!driveRes.ok) throw new Error(driveData.error || 'Could not fetch file from Drive.');
      const { base64, mimeType: mime } = driveData;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scholar: doc.scholar,
          type: 'ingest',
          file: { base64, mime },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (!json.items || json.items.length === 0) throw new Error('No expenses found in this document.');

      setReviews(prev => ({
        ...prev,
        [doc.id]: { items: json.items, model: json.model, scholar: doc.scholar, sem: doc.sem || 'Y1S1' },
      }));
    } catch (err) {
      setExtractError(prev => ({ ...prev, [doc.id]: err.message }));
    } finally {
      setExtracting(prev => ({ ...prev, [doc.id]: false }));
    }
  }

  function handleReviewDiscard(docId) {
    setReviews(prev => { const n = { ...prev }; delete n[docId]; return n; });
    setExtractError(prev => { const n = { ...prev }; delete n[docId]; return n; });
  }

  function handleReviewConfirmed(docId) {
    setReviews(prev => { const n = { ...prev }; delete n[docId]; return n; });
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'linked' } : d));
  }

  const filtered = docs.filter(d => {
    if (filterScholar !== 'all' && d.scholar !== filterScholar) return false;
    if (filterType !== 'all' && d.doc_type !== filterType) return false;
    return true;
  });

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">07</span> Documents
        <span className="eyebrow-rule" />
        <button className="docs-upload-trigger" onClick={() => setUploadOpen(true)}>
          Upload ↑
        </button>
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="docs-body">
          <div className="section-head">
            <h2 className="section-title">Scholar documents</h2>
            <span className="section-note">{docs.length} total · {filtered.length} shown</span>
          </div>

          <div className="docs-filters">
            <select className="docs-filter-sel" value={filterScholar} onChange={e => setFilterScholar(e.target.value)}>
              <option value="all">All scholars</option>
              {scholarKeys.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
            </select>
            <select className="docs-filter-sel" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All types</option>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          {loadError && <p className="docs-load-error">Failed to load documents: {loadError}</p>}

          {filtered.length === 0 ? (
            <div className="docs-empty">
              {docs.length === 0
                ? 'No documents uploaded yet. Use Upload ↑ to add receipts, transcripts, or other files.'
                : 'No documents match the current filter.'}
            </div>
          ) : (
            <div className="docs-list">
              {filtered.map(doc => (
                <div key={doc.id} className={`docs-row docs-row-${doc.status}`}>
                  <div className="docs-row-top">
                    <span className="docs-filename">{doc.filename}</span>
                    <TypeBadge type={doc.doc_type} />
                    <span className="docs-scholar-chip">{doc.scholar}</span>
                    {doc.sem && <span className="docs-sem-chip">{doc.sem}</span>}
                    <StatusBadge status={doc.status} />
                    <span className="docs-date">{doc.uploaded_at ? doc.uploaded_at.slice(0, 10) : ''}</span>
                  </div>

                  {doc.notes && <div className="docs-notes">{doc.notes}</div>}

                  <div className="docs-row-actions">
                    <button className="docs-btn" onClick={() => handleDownload(doc)}>Download</button>
                    {doc.status === 'pending_review' && (
                      <button className="docs-btn docs-btn-secondary" onClick={() => handleMarkReviewed(doc)}>
                        Mark reviewed
                      </button>
                    )}
                    {doc.doc_type === 'receipt' && doc.status !== 'linked' && !reviews[doc.id] && (
                      <button
                        className="docs-btn docs-btn-extract"
                        onClick={() => handleExtract(doc)}
                        disabled={!!extracting[doc.id]}
                      >
                        {extracting[doc.id] ? 'Extracting…' : 'Extract →'}
                      </button>
                    )}
                    <button className="docs-btn docs-btn-delete" onClick={() => handleDelete(doc)}>Delete</button>
                  </div>

                  {extractError[doc.id] && (
                    <p className="docs-extract-error">{extractError[doc.id]}</p>
                  )}

                  {reviews[doc.id] && (
                    <DocReviewCard
                      items={reviews[doc.id].items}
                      model={reviews[doc.id].model}
                      scholar={reviews[doc.id].scholar}
                      sem={reviews[doc.id].sem}
                      docId={doc.id}
                      onDiscard={() => handleReviewDiscard(doc.id)}
                      onConfirmed={() => handleReviewConfirmed(doc.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div className="docs-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setUploadOpen(false); }}>
          <form className="docs-modal" onSubmit={handleUpload}>
            <div className="docs-modal-header">
              <h3 className="docs-modal-title">Upload document</h3>
              <button type="button" className="docs-modal-close" onClick={() => setUploadOpen(false)}>✕</button>
            </div>

            <label className="docs-field-label">Scholar
              <select className="docs-field-input" value={upScholar} onChange={e => setUpScholar(e.target.value)}>
                {scholarKeys.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
              </select>
            </label>

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
    </section>
  );
}
