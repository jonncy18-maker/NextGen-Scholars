import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { SEMESTER_OPTIONS } from '../constants.js';
import {
  ResultDisplay,
  ReviewCard,
  GradeReviewCard,
  WeeklyReportPanel,
  QUICK_PROMPTS,
} from './NavigatorAI.jsx';
import { ExpenseEditPanel } from './expenses/ExpenseWorkbench.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Unified mentor AI console.
//
// One free-form textbox (+ attachments) that replaces the old tabbed Navigator
// AI drawer and the Expense Workbench AI tabs. A deterministic client-side
// router (`routeIntent`) inspects what you typed / attached and dispatches to
// the existing `/api/ask` `type`s — no extra LLM round-trip just to classify.
// Every write still flows through the same human-in-the-loop review cards, so
// nothing hits the database without a confirm step.
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

// Intent labels shown on each turn + offered in the override menu.
const INTENT_META = {
  query: { label: 'Answer', hint: 'Reads the data and answers' },
  ingest: { label: 'Log expense', hint: 'Extracts expense line items to review' },
  grade_ingest: { label: 'Log grades', hint: 'Extracts grade entries to review' },
  expense_bulk_edit: { label: 'Edit expenses', hint: 'Proposes edits to saved expenses' },
  action: { label: 'GCash send', hint: 'Matches a send to unsent items' },
  weekly_report: { label: 'Weekly report', hint: 'Drafts a cohort update' },
};

// Ordered override choices (weekly_report is offered explicitly, not auto-routed
// except on the clear phrase, since it ignores the scholar selector).
const OVERRIDE_ORDER = [
  'query',
  'ingest',
  'grade_ingest',
  'expense_bulk_edit',
  'action',
  'weekly_report',
];

const REPORT_RE = /\b(weekly|cohort)\s+(report|update|summary)\b/i;
const ACTION_RE = /\b(sent|send|sending|gcash|cash(?:ed)?\s?out|transfer(?:red|ring)?)\b/i;
const EDIT_RE =
  /\b(change|update|edit|fix|correct|rename|recategor\w*|reassign|set|delete|remove|drop|move|merge)\b/i;
const ADD_RE = /\b(add|log|record|spent|spend|bought|buy|paid|pay|purchase[ds]?|expense[ds]?)\b/i;
const AMOUNT_RE = /(₱|\bphp\b|\bpeso?s?\b|\d)/i;

// Deterministic intent router. Evaluated in order; first match wins.
export function routeIntent({ text = '', hasFiles = false, fileKind = 'receipt', scholar = '' }) {
  if (hasFiles) return fileKind === 'grades' ? 'grade_ingest' : 'ingest';
  const t = text.trim();
  if (!t) return 'query';
  if (REPORT_RE.test(t)) return 'weekly_report';
  // GCash send-matching is Janndilyne-only (the only scholar with a GCash flow).
  if (scholar === 'janndilyne' && ACTION_RE.test(t)) return 'action';
  if (EDIT_RE.test(t)) return 'expense_bulk_edit';
  if (ADD_RE.test(t) && AMOUNT_RE.test(t)) return 'ingest';
  return 'query';
}

const readFileAsBase64 = (f) =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res({ name: f.name, base64: reader.result.split(',')[1], mime: f.type });
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Per-turn response components ──────────────────────────────────────────────

function Thinking({ label }) {
  return (
    <div className="nai-loading" style={{ marginBottom: 0 }}>
      <span className="nai-loading-dot" />
      <span className="nai-loading-dot" />
      <span className="nai-loading-dot" />
      {label && (
        <span style={{ fontSize: 12, color: 'var(--ngs-muted)', marginLeft: 4 }}>{label}</span>
      )}
    </div>
  );
}

function QueryResponse({ scholar, text }) {
  const [state, setState] = useState({ loading: true, result: null, error: null });
  useEffect(() => {
    let live = true;
    api
      .post('/ask', { scholar, type: 'query', text })
      .then((json) => {
        if (live) setState({ loading: false, result: json, error: null });
      })
      .catch((err) => {
        if (live) setState({ loading: false, result: null, error: err.message });
      });
    return () => {
      live = false;
    };
  }, [scholar, text]);

  if (state.loading) return <Thinking label="Checking the data…" />;
  if (state.error) return <div className="nai-error">{state.error}</div>;
  return <ResultDisplay result={state.result} />;
}

function IngestResponse({ scholar, sem, text, files }) {
  const [state, setState] = useState({ loading: true, review: null, error: null, progress: '' });
  const [done, setDone] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const items = [];
        let model = 'gemini-2.5-flash';
        if (text?.trim()) {
          if (live) setState((s) => ({ ...s, progress: 'Reading your note…' }));
          const json = await api.post('/ask', { scholar, type: 'ingest', sem, text: text.trim() });
          if (json.model) model = json.model;
          if (Array.isArray(json.items)) items.push(...json.items);
        }
        for (let i = 0; i < files.length; i++) {
          if (live)
            setState((s) => ({
              ...s,
              progress:
                files.length > 1
                  ? `Reading receipt ${i + 1} of ${files.length}…`
                  : 'Reading the receipt…',
            }));
          const f = files[i];
          const json = await api.post('/ask', {
            scholar,
            type: 'ingest',
            sem,
            file: { base64: f.base64, mime: f.mime },
          });
          if (json.model) model = json.model;
          if (Array.isArray(json.items)) items.push(...json.items);
        }
        if (!live) return;
        if (items.length === 0)
          setState({
            loading: false,
            review: null,
            error: 'No expense line items found.',
            progress: '',
          });
        else setState({ loading: false, review: { items, model }, error: null, progress: '' });
      } catch (err) {
        if (live) setState({ loading: false, review: null, error: err.message, progress: '' });
      }
    })();
    return () => {
      live = false;
    };
  }, [scholar, sem, text]); // eslint-disable-line react-hooks/exhaustive-deps

  if (done != null)
    return (
      <div className="nai-success">
        ✓ {done} expense{done !== 1 ? 's' : ''} saved to {sem} for {cap(scholar)}.
      </div>
    );
  if (state.loading) return <Thinking label={state.progress || 'Reading…'} />;
  if (state.error) return <div className="nai-error">{state.error}</div>;
  if (!state.review) return null;
  return (
    <ReviewCard
      items={state.review.items}
      model={state.review.model}
      scholar={scholar}
      sem={sem}
      onDiscard={() => setState({ loading: false, review: null, error: null, progress: '' })}
      onConfirmed={(count) => setDone(count)}
    />
  );
}

function GradeResponse({ scholar, sem, files }) {
  const [state, setState] = useState({ loading: true, review: null, error: null, progress: '' });
  const [done, setDone] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const grades = [];
        let model = 'gemini-2.5-flash';
        for (let i = 0; i < files.length; i++) {
          if (live)
            setState((s) => ({
              ...s,
              progress:
                files.length > 1
                  ? `Reading report ${i + 1} of ${files.length}…`
                  : 'Reading the grade report…',
            }));
          const f = files[i];
          const json = await api.post('/ask', {
            scholar,
            type: 'grade_ingest',
            sem,
            file: { base64: f.base64, mime: f.mime },
          });
          if (json.model) model = json.model;
          if (Array.isArray(json.grades)) grades.push(...json.grades);
        }
        if (!live) return;
        if (grades.length === 0)
          setState({
            loading: false,
            review: null,
            error: 'No grade entries found.',
            progress: '',
          });
        else setState({ loading: false, review: { grades, model }, error: null, progress: '' });
      } catch (err) {
        if (live) setState({ loading: false, review: null, error: err.message, progress: '' });
      }
    })();
    return () => {
      live = false;
    };
  }, [scholar, sem]); // eslint-disable-line react-hooks/exhaustive-deps

  if (done != null)
    return (
      <div className="nai-success">
        ✓ {done} subject{done !== 1 ? 's' : ''} saved to {sem} for {cap(scholar)}.
      </div>
    );
  if (state.loading) return <Thinking label={state.progress || 'Reading…'} />;
  if (state.error) return <div className="nai-error">{state.error}</div>;
  if (!state.review) return null;
  return (
    <GradeReviewCard
      grades={state.review.grades}
      model={state.review.model}
      scholar={scholar}
      sem={sem}
      onDiscard={() => setState({ loading: false, review: null, error: null, progress: '' })}
      onConfirmed={(count) => setDone(count)}
    />
  );
}

function ActionResponse({ scholar, text, onRecordSend }) {
  const [state, setState] = useState({ loading: true, msg: null, ok: false });
  const { D } = useData();
  useEffect(() => {
    let live = true;
    api
      .post('/ask', { scholar, type: 'action', text })
      .then((json) => {
        if (!live) return;
        if (json.action === 'record_send' && Array.isArray(json.items) && json.items.length > 0) {
          const items = json.items;
          const sem = items[0].sem || D.scholars[scholar]?.currentSem || '';
          const feeAmt = Number(json.fee) || 0;
          onRecordSend?.(scholar, { itemIds: items.map((it) => String(it.id)), fee: feeAmt, sem });
          const names = items.map((it) => it.item).join(', ');
          setState({
            loading: false,
            ok: true,
            msg: `Recorded ₱${feeAmt.toLocaleString('en-PH')} fee · marked sent: ${names}`,
          });
        } else {
          setState({
            loading: false,
            ok: false,
            msg:
              json.note ||
              json.answer ||
              'Could not match that to any unsent items — try naming them.',
          });
        }
      })
      .catch((err) => {
        if (live) setState({ loading: false, ok: false, msg: err.message });
      });
    return () => {
      live = false;
    };
  }, [scholar, text]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.loading) return <Thinking label="Matching unsent items…" />;
  return state.ok ? (
    <div className="nai-success">✓ {state.msg}</div>
  ) : (
    <div className="nai-error">{state.msg}</div>
  );
}

// Dispatch a turn's captured input to the right response component.
function TurnResponse({ turn, writers }) {
  const { scholarKeys } = useData();
  const { intent, scholar, sem, text, files } = turn;
  switch (intent) {
    case 'ingest':
      return (
        <IngestResponse scholar={scholar} sem={sem} text={files.length ? '' : text} files={files} />
      );
    case 'grade_ingest':
      return <GradeResponse scholar={scholar} sem={sem} files={files} />;
    case 'expense_bulk_edit':
      return (
        <ExpenseEditPanel
          scholar={scholar}
          initialInstruction={text}
          autoRun
          hideHint
          onEditExpense={writers.onEditExpense}
          onDeleteExpense={writers.onDeleteExpense}
        />
      );
    case 'action':
      return <ActionResponse scholar={scholar} text={text} onRecordSend={writers.onRecordSend} />;
    case 'weekly_report':
      return <WeeklyReportPanel scholarKeys={scholarKeys} />;
    case 'query':
    default:
      return <QueryResponse scholar={scholar} text={text} />;
  }
}

// ── Console ───────────────────────────────────────────────────────────────────

export function NavigatorAIConsole({ defaultScholar, writers = {}, onClose }) {
  const { scholarKeys } = useData();
  const [scholar, setScholar] = useState(defaultScholar || scholarKeys[0] || 'claire');
  const [sem, setSem] = useState('Y1S1');
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]); // [{ name, base64, mime }]
  const [fileKind, setFileKind] = useState('receipt'); // 'receipt' | 'grades'
  const [turns, setTurns] = useState([]); // [{ id, scholar, sem, intent, text, files, fileKind }]
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);
  const threadEndRef = useRef(null);
  const turnIdRef = useRef(0);

  useEffect(() => {
    if (defaultScholar) setScholar(defaultScholar);
  }, [defaultScholar]);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length]);

  const addFiles = useCallback(async (fileList) => {
    const arr = Array.from(fileList || []);
    const valid = arr.filter((f) => ACCEPTED_MIME.includes(f.type));
    const invalid = arr.filter((f) => !ACCEPTED_MIME.includes(f.type));
    setFileError(invalid.length ? `${invalid.length} file(s) skipped — unsupported type.` : null);
    const parsed = await Promise.all(valid.map(readFileAsBase64));
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name));
      return [...prev, ...parsed.filter((f) => !seen.has(f.name))];
    });
  }, []);

  function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(
      (i) => i.kind === 'file' && i.type.startsWith('image/')
    );
    if (!item) return;
    e.preventDefault();
    const raw = item.getAsFile();
    const ext = raw.type.split('/')[1] || 'png';
    addFiles([new File([raw], `screenshot-${Date.now()}.${ext}`, { type: raw.type })]);
  }

  function submit(forcedIntent) {
    const text = input.trim();
    if (!text && files.length === 0) return;
    const intent =
      forcedIntent || routeIntent({ text, hasFiles: files.length > 0, fileKind, scholar });
    const id = ++turnIdRef.current;
    setTurns((prev) => [...prev, { id, scholar, sem, intent, text, files, fileKind }]);
    setInput('');
    setFiles([]);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function reRunTurn(turnId, newIntent) {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, intent: newIntent, id: ++turnIdRef.current } : t))
    );
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = input.trim().length > 0 || files.length > 0;

  return (
    <div className="naic">
      <div className="naic-thread">
        {turns.length === 0 ? (
          <div className="naic-welcome">
            <div className="naic-welcome-title">One box for everything.</div>
            <p className="naic-welcome-sub">
              Ask a question, drop a receipt or grade report, add an expense, or fix saved data —
              just say it. Every change is shown for review before it saves.
            </p>
            <div className="naic-examples">
              {[
                'How much has Claire spent overall?',
                'Add ₱500 jeepney fare for Claire today',
                'Change every "food" category to Meals',
                'Weekly cohort report',
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="naic-example"
                  onClick={() => setInput(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="naic-chips">
              {QUICK_PROMPTS.slice(0, 6).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="nai-chip"
                  onClick={() => setInput(p.tpl(scholar))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="naic-turn">
              <div className="naic-user">
                <span className={`scholar-tag t-${turn.scholar}`}>{turn.scholar}</span>
                <div className="naic-user-body">
                  {turn.text && <span className="naic-user-text">{turn.text}</span>}
                  {turn.files.length > 0 && (
                    <span className="naic-user-files">
                      📎 {turn.files.length} file{turn.files.length !== 1 ? 's' : ''}
                      {turn.intent === 'grade_ingest' ? ' · grade report' : ' · receipt'}
                    </span>
                  )}
                </div>
              </div>
              <div className="naic-intent-row">
                <span className="naic-intent-badge">
                  {INTENT_META[turn.intent]?.label || turn.intent}
                </span>
                <span className="naic-intent-hint">{INTENT_META[turn.intent]?.hint}</span>
                {!turn.files.length && (
                  <select
                    className="naic-intent-override"
                    value={turn.intent}
                    onChange={(e) => reRunTurn(turn.id, e.target.value)}
                    title="Not what you meant? Re-run as…"
                  >
                    {OVERRIDE_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {INTENT_META[k].label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="naic-response">
                <TurnResponse turn={turn} writers={writers} />
              </div>
            </div>
          ))
        )}
        <div ref={threadEndRef} />
      </div>

      {files.length > 0 && (
        <div className="naic-attachments">
          <div className="naic-attach-list">
            {files.map((f) => (
              <span key={f.name} className="naic-attach-item">
                {f.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="naic-attach-kind">
            <span>These are:</span>
            <button
              type="button"
              className={`naic-kind-btn${fileKind === 'receipt' ? ' is-on' : ''}`}
              onClick={() => setFileKind('receipt')}
            >
              Receipts
            </button>
            <button
              type="button"
              className={`naic-kind-btn${fileKind === 'grades' ? ' is-on' : ''}`}
              onClick={() => setFileKind('grades')}
            >
              Grades
            </button>
          </div>
        </div>
      )}
      {fileError && (
        <div className="nai-error" style={{ margin: '0 12px 6px' }}>
          {fileError}
        </div>
      )}

      <div className="naic-composer">
        <div className="naic-composer-meta">
          <select
            className="nai-scholar-select"
            value={scholar}
            onChange={(e) => setScholar(e.target.value)}
            title="Scholar"
          >
            {scholarKeys.map((k) => (
              <option key={k} value={k}>
                {cap(k)}
              </option>
            ))}
          </select>
          <select
            className="nai-scholar-select"
            value={sem}
            onChange={(e) => setSem(e.target.value)}
            title="Semester (for logged expenses/grades)"
          >
            {SEMESTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="naic-composer-row">
          <button
            type="button"
            className="naic-attach-btn"
            title="Attach receipt or grade report"
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
            }}
          />
          <textarea
            className="naic-input"
            rows={1}
            placeholder="Ask, log an expense, upload a receipt, or fix saved data…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            autoFocus
          />
          <button type="button" className="naic-send" onClick={() => submit()} disabled={!canSend}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
