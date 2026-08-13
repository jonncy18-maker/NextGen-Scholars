import React, { useState } from 'react';
import { api } from '../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Agent UI — the confirm step for AI-proposed changes.
//
// /api/agent never writes during a `plan` turn. When the assistant wants to
// change something it comes back with `status: 'proposal'` and a list of
// calls; this file renders them as a card and posts them back with
// `mode: 'confirm'` only when the human clicks Save. Discarding just drops
// them client-side — there is nothing to roll back, because nothing ran.
//
// Used by both surfaces: the mentor console (NavigatorAIConsole's `agent`
// intent) and the scholar chat panel (ScholarChatPanel).
// ─────────────────────────────────────────────────────────────────────────────

export async function agentPlan({ text, messages = [] }) {
  return api.post('/agent', { mode: 'plan', text, messages });
}

export async function agentConfirm(calls) {
  const res = await api.post('/agent', { mode: 'confirm', calls });
  // Poke the polling hook so the dashboard reflects the write immediately
  // rather than on the next ~25s tick.
  api.afterWrite();
  return res;
}

// Fields worth showing on the card beneath the one-line summary. The summary
// already carries the headline; this is for double-checking the details.
function argRows(args) {
  return Object.entries(args || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
}

export function ProposalCard({ proposals, note, onDone }) {
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [discarded, setDiscarded] = useState(false);
  const [error, setError] = useState(null);
  // Locally dropped rows — lets you approve two of three proposed changes.
  const [skipped, setSkipped] = useState(() => new Set());

  const live = proposals.filter((_, i) => !skipped.has(i));

  async function save() {
    if (!live.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await agentConfirm(live.map((p) => ({ name: p.name, args: p.args })));
      setResults(res.results || []);
      onDone?.(res);
    } catch (err) {
      setError(err.message || 'Could not save these changes.');
    } finally {
      setBusy(false);
    }
  }

  if (discarded) {
    return <div className="agent-card agent-card-done">Discarded — nothing was saved.</div>;
  }

  if (results) {
    const failed = results.filter((r) => !r.ok);
    return (
      <div className={`agent-card ${failed.length ? 'agent-card-partial' : 'agent-card-done'}`}>
        <div className="agent-card-title">
          {failed.length
            ? `${results.length - failed.length} of ${results.length} saved`
            : `Saved ${results.length} change${results.length === 1 ? '' : 's'}`}
        </div>
        <ul className="agent-result-list">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? 'agent-result-ok' : 'agent-result-fail'}>
              <span className="agent-result-mark">{r.ok ? '✓' : '✕'}</span>
              <span>
                {r.summary || r.name}
                {r.ok ? '' : ` — ${r.error}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="agent-card">
      <div className="agent-card-head">
        <span className="agent-card-badge">Needs your OK</span>
        <span className="agent-card-title">
          {live.length} change{live.length === 1 ? '' : 's'} ready to save
        </span>
      </div>
      {note && <p className="agent-card-note">{note}</p>}

      <ul className="agent-proposal-list">
        {proposals.map((p, i) => {
          const dropped = skipped.has(i);
          const rows = argRows(p.args);
          return (
            <li key={i} className={`agent-proposal ${dropped ? 'agent-proposal-dropped' : ''}`}>
              <div className="agent-proposal-row">
                <button
                  type="button"
                  className="agent-proposal-summary"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  aria-expanded={expanded === i}
                >
                  <span className="agent-proposal-caret">{expanded === i ? '▾' : '▸'}</span>
                  {p.summary}
                </button>
                <button
                  type="button"
                  className="agent-proposal-skip"
                  onClick={() =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                >
                  {dropped ? 'Include' : 'Skip'}
                </button>
              </div>
              {expanded === i && (
                <table className="agent-proposal-detail">
                  <tbody>
                    <tr>
                      <th>action</th>
                      <td>{p.name}</td>
                    </tr>
                    {rows.map(([k, v]) => (
                      <tr key={k}>
                        <th>{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          );
        })}
      </ul>

      {error && <div className="agent-card-error">{error}</div>}

      <div className="agent-card-actions">
        <button
          type="button"
          className="agent-btn agent-btn-primary"
          onClick={save}
          disabled={busy || !live.length}
        >
          {busy
            ? 'Saving…'
            : live.length
              ? `Save ${live.length} change${live.length === 1 ? '' : 's'}`
              : 'Nothing selected'}
        </button>
        <button
          type="button"
          className="agent-btn"
          onClick={() => setDiscarded(true)}
          disabled={busy}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// What the assistant looked at on the way to its answer. Collapsed by default —
// it matters when an answer looks wrong and you want to see which rows it read.
export function AgentSteps({ steps }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  return (
    <div className="agent-steps">
      <button type="button" className="agent-steps-toggle" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} looked at {steps.length} thing{steps.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="agent-steps-list">
          {steps.map((s, i) => (
            <li key={i}>
              <code>{s.tool}</code>
              {Object.keys(s.args || {}).length > 0 && (
                <span className="agent-steps-args"> {JSON.stringify(s.args)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Renders one agent result — answer text, or a proposal card, or an error.
export function AgentResult({ data, onDone }) {
  if (!data) return null;
  if (data.status === 'proposal') {
    return (
      <div className="agent-result">
        <ProposalCard proposals={data.proposals} note={data.note} onDone={onDone} />
        <AgentSteps steps={data.steps} />
      </div>
    );
  }
  return (
    <div className="agent-result">
      <div className="agent-answer">{data.answer}</div>
      <AgentSteps steps={data.steps} />
    </div>
  );
}
