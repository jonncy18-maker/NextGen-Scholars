import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';

const DOC_TYPES = ['receipt', 'transcript', 'visa', 'oet', 'other'];

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
  claire:     { name: 'Claire',     homeHref: '/home/claire' },
  april:      { name: 'April',      homeHref: '/home/april' },
  janndilyne: { name: 'Janndilyne', homeHref: '/home/janndilyne' },
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
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'sd-status-pending' };
  return <span className={`doc-status-badge ${cls}`}>{label}</span>;
}

export function ScholarDocuments({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;
  const [name, setName]       = useState(fallback.name);
  const [docs, setDocs]       = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [loadError, setLoadError]   = useState(null);

  useEffect(() => {
    sessionStorage.setItem('ngs_auth_scholar', scholarKey);
  }, [scholarKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scholarRes, docsRes] = await Promise.all([
          supabase.from('scholars').select('first_name').eq('scholar_key', scholarKey).limit(1),
          supabase.from('documents').select('*').eq('scholar', scholarKey).order('uploaded_at', { ascending: false }),
        ]);
        if (cancelled) return;
        const fn = scholarRes.data?.[0]?.first_name;
        if (fn) setName(fn);
        if (docsRes.error) throw docsRes.error;
        setDocs(docsRes.data ?? []);
      } catch (err) {
        if (!cancelled) { setLoadError(err.message); setDocs([]); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [scholarKey]);

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
              </div>

              {loadError && (
                <p className="docs-load-error">Could not load documents: {loadError}</p>
              )}

              {filtered.length === 0 ? (
                <div className="docs-empty">
                  {total === 0
                    ? 'No documents on file yet. Your mentor uploads receipts, transcripts, and records here.'
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
    </div>
  );
}
