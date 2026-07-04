import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { EXPENSE_CATS, AVB_OPTIONS } from '../constants.js';
import { NGS_DATA } from '../../scholars-data.js';
import { updateExpense, writeActivityLog, writeSubmission, resubmitExpense, markSubmissionReadByScholar } from '../api-writer.js';
import { loadFromSupabase, loadScholarSubmissions } from '../api-loader.js';
import { useChanges } from '../hooks/useChanges.js';
import { authClient, signIn } from '../lib/auth-client.js';
import { api } from '../lib/api.js';
import { groupExpenses } from '../components/expenses/filterHelpers.js';
import { ScholarChatPanel } from '../components/ScholarChatPanel.jsx';
import { ScholarIngestPanel } from '../components/ScholarIngestPanel.jsx';
import { ExpenseAskWidget } from '../components/ExpenseAskWidget.jsx';
import '../styles/entry.css';

const SCHOLARS = Object.entries(NGS_DATA.scholars)
  .filter(([, s]) => s.status === 'active' || s.status === 'trial')
  .map(([key, s]) => ({
    key,
    display: s.firstName,
    sems: key === 'claire'
      ? ['Y2S1', 'Y2S2', 'Y3S1', 'Y3S2']
      : key === 'april'
        ? ['TG11S1', 'TG11S2', 'TG12S1', 'TG12S2']
        : [],
    defaultSem: s.currentSem,
  }));

const TODAY_ISO = new Date().toISOString().split('T')[0];

function makeEmptyRow(defaultSem) {
  return {
    _id: `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    item: '',
    cat: EXPENSE_CATS[0],
    amount: '',
    qty: '1',
    date: TODAY_ISO,
    sem: defaultSem,
    avb: AVB_OPTIONS[0],
    vendor: '',
  };
}

export function EntryApp() {
  const [scholarKey, setScholarKey] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authClient.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data?.session) { setCheckingSession(false); return; }
      try {
        const me = await api.get('/me');
        if (!cancelled && SCHOLARS.some(s => s.key === me.scholarKey)) setScholarKey(me.scholarKey);
      } catch {
        // fall through to the sign-in form
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }).catch(() => { if (!cancelled) setCheckingSession(false); });
    return () => { cancelled = true; };
  }, []);

  function logout() {
    authClient.signOut();
    setScholarKey(null);
  }

  if (checkingSession) return null;

  if (!scholarKey) return <EntrySignIn onSignedIn={setScholarKey} />;

  const scholar = SCHOLARS.find(s => s.key === scholarKey);
  return <ExpenseForm scholar={scholar} onLogout={logout} />;
}

// Real Neon Auth (Better Auth) sign-in — replaces the old scholar-picker +
// shared cosmetic password. The account itself identifies the scholar (via
// GET /api/me, resolved server-side from user_profile), so there's no picker.
function EntrySignIn({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await signIn.email({ email, password });
    if (authError) {
      setLoading(false);
      setError('Incorrect credentials — try again.');
      return;
    }

    try {
      const me = await api.get('/me');
      if (!SCHOLARS.some(s => s.key === me.scholarKey)) {
        await authClient.signOut();
        setError("This account isn't set up for expense entry yet.");
        setLoading(false);
        return;
      }
      onSignedIn(me.scholarKey);
    } catch {
      await authClient.signOut();
      setError('Could not verify your account — try again.');
      setLoading(false);
    }
  }

  return (
    <div className="el-lock">
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Add Expenses</h1>
        <p className="el-sub">Sign in to continue</p>
        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={handleSubmit} autoComplete="off">
          <div className="el-field">
            <label className="el-label" htmlFor="ea-email">Email</label>
            <input
              id="ea-email"
              ref={inputRef}
              className="el-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
            />
          </div>
          <div className="el-field">
            <label className="el-label" htmlFor="ea-pw">Password</label>
            <input
              id="ea-pw"
              className="el-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
            />
          </div>
          <div className={`el-err${error ? ' show' : ''}`}>{error}</div>
          <button type="submit" disabled={!email || !password || loading} className="el-btn">
            {loading ? 'Signing in…' : 'Continue →'}
          </button>
        </form>
        <Link href="/" className="el-back">← Back to NextGen Scholars</Link>
      </div>
    </div>
  );
}

// ── Pending submissions awaiting mentor approval ──────────────────────────────
function PendingReview({ submissions, openComments, resubmitingId, resubmitDraft, setResubmitDraft, onToggleComment, onStartResubmit, onCancelResubmit, onHandleResubmit }) {
  if (!submissions.length) return null;

  return (
    <div className="ef-pending-section">
      <div className="ef-pending-header">
        <span className="ef-pending-title">Pending Review</span>
        <span className="ef-pending-count">{submissions.length} awaiting mentor approval</span>
      </div>
      <div className="ef-pending-list">
        {submissions.map(sub => {
          const exp = sub.expense_data || {};
          const total = (exp.amount || 0) * (exp.qty || 1);
          const isRejected = sub.status === 'rejected';
          const commentOpen = openComments.has(sub.id);
          const isResubmiting = resubmitingId === sub.id;

          return (
            <div key={sub.id} className={`ef-pending-item${isRejected ? ' is-rejected' : ''}`}>
              <div className="ef-pending-item-main">
                <span className="ef-pending-item-name">{exp.item}</span>
                <span className="ef-pending-item-amt">₱{Math.round(total).toLocaleString('en-US')}</span>
                <span className="ef-pending-item-meta">{exp.cat}</span>
                <span className="ef-pending-item-meta">{exp.sem}</span>
                <span className="ef-pending-item-meta">{exp.date}</span>
                {isRejected ? (
                  <span className="ef-pending-badge rejected">Rejected</span>
                ) : (
                  <span className="ef-pending-badge pending">Pending review</span>
                )}
                {isRejected && sub.rejection_comment && (
                  <button
                    className="ef-pending-comment-btn"
                    title="View rejection reason"
                    onClick={() => onToggleComment(sub.id)}
                  >
                    💬
                  </button>
                )}
              </div>
              {isRejected && commentOpen && sub.rejection_comment && (
                <div className="ef-pending-comment">{sub.rejection_comment}</div>
              )}
              {isRejected && !isResubmiting && (
                <div className="ef-pending-actions">
                  <button className="ef-resubmit-btn" onClick={() => onStartResubmit(sub)}>
                    Edit &amp; Resubmit
                  </button>
                </div>
              )}
              {isRejected && isResubmiting && (
                <div className="ef-resubmit-form">
                  <label className="ef-edit-field"><span>Item</span>
                    <input value={resubmitDraft.item} onChange={e => setResubmitDraft(d => ({ ...d, item: e.target.value }))} /></label>
                  <label className="ef-edit-field"><span>Category</span>
                    <select value={resubmitDraft.cat} onChange={e => setResubmitDraft(d => ({ ...d, cat: e.target.value }))}>
                      {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></label>
                  <label className="ef-edit-field"><span>Amount (₱)</span>
                    <input type="number" step="0.01" min="0" value={resubmitDraft.amount}
                      onChange={e => setResubmitDraft(d => ({ ...d, amount: e.target.value }))} /></label>
                  <label className="ef-edit-field"><span>Qty</span>
                    <input type="number" min="1" value={resubmitDraft.qty}
                      onChange={e => setResubmitDraft(d => ({ ...d, qty: e.target.value }))} /></label>
                  <label className="ef-edit-field"><span>Date</span>
                    <input type="date" value={resubmitDraft.date}
                      onChange={e => setResubmitDraft(d => ({ ...d, date: e.target.value }))} /></label>
                  <label className="ef-edit-field"><span>Status</span>
                    <select value={resubmitDraft.avb} onChange={e => setResubmitDraft(d => ({ ...d, avb: e.target.value }))}>
                      {AVB_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></label>
                  <label className="ef-edit-field"><span>Vendor</span>
                    <input value={resubmitDraft.vendor} onChange={e => setResubmitDraft(d => ({ ...d, vendor: e.target.value }))} /></label>
                  <div className="ef-edit-actions">
                    <button className="ef-edit-save" onClick={() => onHandleResubmit(sub)}>Resubmit</button>
                    <button className="ef-edit-cancel" onClick={onCancelResubmit}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Approved expenses table with optional grouping ────────────────────────────
function ApprovedExpensesTable({ currentSem, semExpenses, groupBy, setGroupBy, expandedGroups, setExpandedGroups, editingId, editDraft, setEditDraft, pendingDeletes, onStartEdit, onCancelEdit, onSaveEdit, onRequestDelete }) {
  if (!semExpenses.length) return null;

  const groups = groupExpenses(semExpenses, groupBy);
  const allExpanded = groups && groups.length > 0 && groups.every(g => expandedGroups.has(g.key));

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function renderEntryRow(e, i) {
    const total = (e.amount || 0) * (e.qty || 1);
    const isPending = pendingDeletes.has(String(e.id));
    const isEditing = editingId === e.id;

    if (isEditing) {
      return (
        <React.Fragment key={e.id || i}>
          <tr className="ef-entries-editing-hd">
            <td className="ef-entries-item">{e.item}</td>
            <td><span className="ef-entries-cat" data-cat={e.cat}>{e.cat}</span></td>
            <td className="ef-entries-date">{e.date}</td>
            <td className="ef-entries-right ef-entries-amount">₱{Math.round(total).toLocaleString('en-US')}</td>
            <td><span className={`ef-entries-status is-${(e.avb || '').toLowerCase()}`}>{e.avb}</span></td>
            <td className="ef-entries-actions"><button className="ef-row-cancel" onClick={onCancelEdit}>Cancel</button></td>
          </tr>
          <tr className="ef-edit-row">
            <td colSpan={6}>
              <div className="ef-edit-form">
                <label className="ef-edit-field"><span>Item</span>
                  <input value={editDraft.item} onChange={ev => setEditDraft(d => ({ ...d, item: ev.target.value }))} /></label>
                <label className="ef-edit-field"><span>Category</span>
                  <select value={editDraft.cat} onChange={ev => setEditDraft(d => ({ ...d, cat: ev.target.value }))}>
                    {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></label>
                <label className="ef-edit-field"><span>Amount (₱)</span>
                  <input type="number" step="0.01" min="0" value={editDraft.amount} onChange={ev => setEditDraft(d => ({ ...d, amount: ev.target.value }))} /></label>
                <label className="ef-edit-field"><span>Qty</span>
                  <input type="number" min="1" value={editDraft.qty} onChange={ev => setEditDraft(d => ({ ...d, qty: ev.target.value }))} /></label>
                <label className="ef-edit-field"><span>Date</span>
                  <input type="date" value={editDraft.date} onChange={ev => setEditDraft(d => ({ ...d, date: ev.target.value }))} /></label>
                <label className="ef-edit-field"><span>Status</span>
                  <select value={editDraft.avb} onChange={ev => setEditDraft(d => ({ ...d, avb: ev.target.value }))}>
                    {AVB_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></label>
                <label className="ef-edit-field"><span>Vendor</span>
                  <input value={editDraft.vendor} onChange={ev => setEditDraft(d => ({ ...d, vendor: ev.target.value }))} /></label>
                <div className="ef-edit-actions">
                  <button className="ef-edit-save" onClick={() => onSaveEdit(e)}>Save changes</button>
                  <button className="ef-edit-cancel" onClick={onCancelEdit}>Cancel</button>
                </div>
              </div>
            </td>
          </tr>
        </React.Fragment>
      );
    }

    return (
      <tr key={i} className={[e.avb !== AVB_OPTIONS[0] ? 'ef-entries-budget' : '', isPending ? 'ef-entries-pending-del' : ''].filter(Boolean).join(' ')}>
        <td className="ef-entries-item">{e.item}</td>
        <td><span className="ef-entries-cat" data-cat={e.cat}>{e.cat}</span></td>
        <td className="ef-entries-date">{e.date}</td>
        <td className="ef-entries-right ef-entries-amount">₱{Math.round(total).toLocaleString('en-US')}</td>
        <td>{isPending ? <span className="ef-del-pending">Delete requested</span>
          : <span className={`ef-entries-status is-${(e.avb || '').toLowerCase()}`}>{e.avb}</span>}</td>
        <td className="ef-entries-actions">
          {!isPending && (<>
            <button className="ef-row-edit" onClick={() => onStartEdit(e)}>Edit</button>
            <button className="ef-row-del" onClick={() => onRequestDelete(e)}>Delete</button>
          </>)}
        </td>
      </tr>
    );
  }

  return (
    <div className="ef-entries">
      <div className="ef-entries-header">
        <span className="ef-entries-title">{currentSem} · {semExpenses.length} item{semExpenses.length !== 1 ? 's' : ''}</span>
        <div className="ef-groupby">
          <span className="ef-groupby-label">Group</span>
          <div className="ef-groupby-chips">
            {[['none','None'],['month','Month'],['category','Category']].map(([val, lbl]) => (
              <button key={val} className={groupBy === val ? 'active' : ''}
                onClick={() => { setGroupBy(val); setExpandedGroups(new Set()); }}>{lbl}</button>
            ))}
          </div>
          {groups && groups.length > 0 && (
            <button className="ef-groupby-all-btn" onClick={() =>
              setExpandedGroups(allExpanded ? new Set() : new Set(groups.map(g => g.key)))}>
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>
      </div>
      <div className="ef-entries-scroll">
        <table className="ef-entries-table">
          <thead>
            <tr>
              <th>Item</th><th>Category</th><th>Date</th>
              <th className="ef-entries-right">Total</th><th>Status</th><th />
            </tr>
          </thead>
          {groups
            ? groups.map(group => {
                const collapsed = !expandedGroups.has(group.key);
                return (
                  <React.Fragment key={group.key}>
                    <tbody>
                      <tr className="ef-group-hd" onClick={() => toggleGroup(group.key)}>
                        <td colSpan={6}>
                          <span>{collapsed ? '▶' : '▼'}</span>
                          <span className="ef-group-label">{group.label}</span>
                          <span className="ef-group-meta">{group.rows.length} item{group.rows.length !== 1 ? 's' : ''}</span>
                          <span className="ef-group-total">₱{Math.round(group.total).toLocaleString('en-US')}</span>
                        </td>
                      </tr>
                    </tbody>
                    {!collapsed && (
                      <tbody>
                        {group.rows.map(renderEntryRow)}
                        <tr className="ef-subtotal">
                          <td colSpan={3} className="ef-subtotal-label">Subtotal — {group.label}</td>
                          <td className="ef-subtotal-amt ef-entries-right">₱{Math.round(group.total).toLocaleString('en-US')}</td>
                          <td /><td />
                        </tr>
                      </tbody>
                    )}
                  </React.Fragment>
                );
              })
            : <tbody>{semExpenses.map(renderEntryRow)}</tbody>
          }
        </table>
      </div>
    </div>
  );
}

function ExpenseForm({ scholar, onLogout }) {
  const [currentSem, setCurrentSem] = useState(scholar.defaultSem);

  const [form, setForm] = useState({
    item: '', cat: EXPENSE_CATS[0],
    amount: '', qty: '1', date: TODAY_ISO, avb: AVB_OPTIONS[0], vendor: '',
  });
  const [entryMode, setEntryMode] = useState(null); // null | 'single' | 'multiple'
  const [submitState, setSubmitState] = useState('idle');

  const [multiRows, setMultiRows] = useState(() => [makeEmptyRow(scholar.defaultSem), makeEmptyRow(scholar.defaultSem)]);
  const [multiSubmitState, setMultiSubmitState] = useState('idle');

  const [expensesBySem, setExpensesBySem] = useState(null);
  const [groupBy, setGroupBy] = useState('none');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [pendingDeletes, setPendingDeletes] = useState(new Set());

  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [openComments, setOpenComments] = useState(new Set());
  const [resubmitingId, setResubmitingId] = useState(null);
  const [resubmitDraft, setResubmitDraft] = useState({});

  useEffect(() => {
    loadFromSupabase()
      .then(data => {
        const sd = data.scholars?.[scholar.key];
        setExpensesBySem(sd?.expenses || {});
        if (sd?.currentSem) setCurrentSem(sd.currentSem);
      })
      .catch(() => setExpensesBySem({}));

    loadScholarSubmissions(scholar.key)
      .then(setPendingSubmissions)
      .catch(() => {});
  }, [scholar.key]);

  // Polling (replaces the old Supabase realtime channel): submissions and
  // expenses are small per-scholar tables, cheapest to just refetch in full
  // on any change (an approval touches both).
  useChanges(deltas => {
    if (deltas.expense_submissions?.rows.length) {
      loadScholarSubmissions(scholar.key).then(setPendingSubmissions).catch(() => {});
    }
    if (deltas.expenses?.rows.length || deltas.expenses?.deletedIds.length) {
      loadFromSupabase()
        .then(data => setExpensesBySem(data.scholars?.[scholar.key]?.expenses || {}))
        .catch(() => {});
    }
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const singleValid = form.item.trim() && form.amount &&
    !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0;

  async function handleSingleSubmit(e) {
    e.preventDefault();
    if (!singleValid) return;
    const expData = {
      id:     `${scholar.key}_${currentSem}_${Date.now()}`,
      sem:    currentSem,
      item:   form.item.trim(),
      cat:    form.cat,
      amount: parseFloat(form.amount),
      qty:    parseInt(form.qty, 10) || 1,
      date:   form.date,
      avb:    form.avb,
      sent:   'No',
      vendor: form.vendor.trim(),
    };
    setSubmitState('submitting');
    try {
      const sub = await writeSubmission(scholar.key, expData);
      setPendingSubmissions(prev => [sub, ...prev]);
      setSubmitState('done');
      setTimeout(() => {
        setSubmitState('idle');
        setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' }));
        setEntryMode(null);
      }, 1800);
    } catch (err) {
      console.error('writeSubmission failed:', err);
      setSubmitState('idle');
    }
  }

  const filledRows = multiRows.filter(r => r.item.trim() && r.amount && !isNaN(parseFloat(r.amount)) && parseFloat(r.amount) > 0);

  function updateMultiRow(idx, field, val) {
    setMultiRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function removeMultiRow(idx) {
    if (multiRows.length <= 1) return;
    setMultiRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleMultiSubmit(e) {
    e.preventDefault();
    if (filledRows.length === 0) return;
    setMultiSubmitState('submitting');
    try {
      const subs = await Promise.all(filledRows.map(r => {
        const expData = {
          id:     `${scholar.key}_${currentSem}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          sem:    currentSem,
          item:   r.item.trim(),
          cat:    r.cat,
          amount: parseFloat(r.amount),
          qty:    parseInt(r.qty, 10) || 1,
          date:   r.date,
          avb:    r.avb,
          sent:   'No',
          vendor: r.vendor.trim(),
        };
        return writeSubmission(scholar.key, expData);
      }));
      setPendingSubmissions(prev => [...subs, ...prev]);
      setMultiSubmitState('done');
      setTimeout(() => {
        setMultiSubmitState('idle');
        setMultiRows([makeEmptyRow(scholar.defaultSem), makeEmptyRow(scholar.defaultSem)]);
        setEntryMode(null);
      }, 1800);
    } catch (err) {
      console.error('multiSubmit failed:', err);
      setMultiSubmitState('idle');
    }
  }

  function startEdit(exp) {
    setEditingId(exp.id);
    setEditDraft({ item: exp.item || '', cat: exp.cat || '', date: exp.date || '',
      amount: String(exp.amount || ''), qty: String(exp.qty || 1),
      avb: exp.avb || AVB_OPTIONS[0], vendor: exp.vendor || '' });
  }
  function cancelEdit() { setEditingId(null); setEditDraft({}); }
  function saveEdit(originalExp) {
    const fields = { item: editDraft.item.trim(), cat: editDraft.cat, date: editDraft.date,
      amount: parseFloat(editDraft.amount) || 0, qty: parseInt(editDraft.qty, 10) || 1,
      avb: editDraft.avb, vendor: editDraft.vendor.trim() };
    const updated = { ...originalExp, ...fields };
    setExpensesBySem(prev => {
      const sem = originalExp.sem;
      return { ...prev, [sem]: (prev[sem] || []).map(e => e.id === originalExp.id ? updated : e) };
    });
    updateExpense(originalExp.id, fields).catch(err => console.error('updateExpense failed:', err));
    const changes = {};
    ['item','cat','date','amount','qty','avb','vendor'].forEach(k => {
      if (String(originalExp[k]) !== String(updated[k])) changes[k] = [originalExp[k], updated[k]];
    });
    writeActivityLog({ scholar: scholar.key, type: 'edited', expense_id: String(originalExp.id), expense_data: updated, changes })
      .catch(err => console.error('writeActivityLog failed:', err));
    setEditingId(null); setEditDraft({});
  }
  function requestDelete(exp) {
    if (pendingDeletes.has(String(exp.id))) return;
    setPendingDeletes(prev => new Set([...prev, String(exp.id)]));
    writeActivityLog({ scholar: scholar.key, type: 'delete_request', expense_id: String(exp.id), expense_data: exp })
      .catch(err => console.error('writeActivityLog failed:', err));
  }

  function startResubmit(sub) {
    const exp = sub.expense_data || {};
    setResubmitingId(sub.id);
    setResubmitDraft({ item: exp.item || '', cat: exp.cat || EXPENSE_CATS[0],
      amount: String(exp.amount || ''), qty: String(exp.qty || 1),
      date: exp.date || TODAY_ISO,
      avb: exp.avb || AVB_OPTIONS[0], vendor: exp.vendor || '' });
    if (!sub.read_by_scholar) markSubmissionReadByScholar(sub.id).catch(() => {});
  }
  function cancelResubmit() { setResubmitingId(null); setResubmitDraft({}); }

  async function handleResubmit(sub) {
    const expData = {
      id:     `${scholar.key}_${currentSem}_${Date.now()}`,
      sem:    currentSem,
      item:   resubmitDraft.item.trim(),
      cat:    resubmitDraft.cat,
      amount: parseFloat(resubmitDraft.amount) || 0,
      qty:    parseInt(resubmitDraft.qty, 10) || 1,
      date:   resubmitDraft.date,
      avb:    resubmitDraft.avb,
      sent:   'No',
      vendor: resubmitDraft.vendor.trim(),
    };
    try {
      const newSub = await resubmitExpense(sub.id, scholar.key, expData);
      setPendingSubmissions(prev => [newSub, ...prev.filter(s => s.id !== sub.id)]);
      setResubmitingId(null); setResubmitDraft({});
    } catch (err) { console.error('resubmit failed:', err); }
  }

  function toggleComment(id) {
    setOpenComments(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    const sub = pendingSubmissions.find(s => s.id === id);
    if (sub && !sub.read_by_scholar) markSubmissionReadByScholar(id).catch(() => {});
  }

  const semExpenses = expensesBySem?.[currentSem] || [];
  const actualTotal = semExpenses.filter(e => e.avb === AVB_OPTIONS[0]).reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const budgetTotal = semExpenses.filter(e => e.avb !== AVB_OPTIONS[0]).reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);

  return (
    <div className="ef-page" data-scholar={scholar.key}>
      <header className="ef-header">
        <div className="ef-header-left">
          <div className="el-badge el-badge-sm"><span>N</span><span>G</span><span>S</span></div>
          <span className="ef-header-title">Add Expense — <strong>{scholar.display}</strong></span>
        </div>
        <div className="ef-header-right">
          <Link href={`/home/${scholar.key}`} className="ef-home-link">← Portal home</Link>
          <button className="ef-logout" onClick={onLogout}>Switch scholar</button>
        </div>
      </header>

      <main className="ef-main">
        <ScholarChatPanel
          scholarKey={scholar.key}
          ingestionLabel="Upload receipt"
          onGoToIngestion={() => document.getElementById('scholar-expense-ingest')?.scrollIntoView({ behavior: 'smooth' })}
        />

        {expensesBySem !== null && (
          <div className="ef-summary">
            <div className="ef-summary-stat">
              <span className="ef-summary-label">Actual spend</span>
              <strong className="ef-summary-val">₱{Math.round(actualTotal).toLocaleString('en-US')}</strong>
            </div>
            {budgetTotal > 0 && (
              <div className="ef-summary-stat">
                <span className="ef-summary-label">Pending</span>
                <strong className="ef-summary-val">₱{Math.round(budgetTotal).toLocaleString('en-US')}</strong>
              </div>
            )}
            <div className="ef-summary-stat">
              <span className="ef-summary-label">Items</span>
              <strong className="ef-summary-val">{semExpenses.length}</strong>
            </div>
            <span className="ef-summary-sem">{currentSem}</span>
          </div>
        )}

        <PendingReview
          submissions={pendingSubmissions}
          openComments={openComments}
          resubmitingId={resubmitingId}
          resubmitDraft={resubmitDraft}
          setResubmitDraft={setResubmitDraft}
          onToggleComment={toggleComment}
          onStartResubmit={startResubmit}
          onCancelResubmit={cancelResubmit}
          onHandleResubmit={handleResubmit}
        />

        {entryMode === null && (
          <div className="ef-mode-chooser">
            <button className="ef-mode-card" onClick={() => setEntryMode('single')}>
              <svg className="ef-mode-card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="ef-mode-card-label">Single expense</span>
              <span className="ef-mode-card-desc">One item · quick form</span>
            </button>
            <button className="ef-mode-card" onClick={() => setEntryMode('multiple')}>
              <svg className="ef-mode-card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M3 10h18M3 14h12M3 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="ef-mode-card-label">Batch entry</span>
              <span className="ef-mode-card-desc">Multiple items · spreadsheet style</span>
            </button>
          </div>
        )}

        {entryMode === 'single' && (
          <div className="ef-entry-card">
            <div className="ef-entry-card-hd">
              <span className="ef-entry-card-title">Add expense</span>
              <button className="ef-entry-card-close" onClick={() => setEntryMode(null)}>✕</button>
            </div>
            {submitState === 'done' && <div className="ef-toast">✓ Submitted for review</div>}
            <form className="ef-grid" onSubmit={handleSingleSubmit}>
              <div className="ef-field ef-field-wide">
                <label>Item</label>
                <input type="text" placeholder="e.g. Tuition — Prelim" value={form.item}
                  onChange={e => set('item', e.target.value)} autoFocus />
              </div>
              <div className="ef-field">
                <label>Category</label>
                <select value={form.cat} onChange={e => set('cat', e.target.value)}>
                  {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="ef-field">
                <label>Amount (₱)</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount}
                  onChange={e => set('amount', e.target.value)} />
              </div>
              <div className="ef-field">
                <label>Qty</label>
                <input type="number" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
              </div>
              <div className="ef-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="ef-field">
                <label>Status</label>
                <select value={form.avb} onChange={e => set('avb', e.target.value)}>
                  {AVB_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="ef-field ef-field-wide">
                <label>Vendor <span className="ef-optional">(optional)</span></label>
                <input type="text" placeholder="Optional" value={form.vendor}
                  onChange={e => set('vendor', e.target.value)} />
              </div>
              <div className="ef-submit-row">
                <button type="submit" disabled={!singleValid || submitState === 'submitting'}
                  className={`ef-save${submitState === 'done' ? ' is-saved' : ''}`}>
                  {submitState === 'done' ? '✓ Submitted' : submitState === 'submitting' ? 'Submitting…' : 'Submit expense'}
                </button>
              </div>
            </form>
          </div>
        )}

        {entryMode === 'multiple' && (
          <div className="ef-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEntryMode(null); }}>
            <div className="ef-modal-panel">
              <div className="ef-modal-hd">
                <span className="ef-entry-card-title">Add multiple expenses</span>
                <button className="ef-entry-card-close" onClick={() => setEntryMode(null)}>✕</button>
              </div>
              {multiSubmitState === 'done' && <div className="ef-toast ef-modal-toast">✓ {filledRows.length} expense{filledRows.length !== 1 ? 's' : ''} submitted for review</div>}
              <form onSubmit={handleMultiSubmit} className="ef-modal-form">
                <div className="ef-multi-scroll ef-modal-scroll">
                  <table className="ef-multi-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Amount (₱)</th>
                        <th>Qty</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Vendor</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {multiRows.map((row, idx) => (
                        <tr key={row._id} className="ef-multi-row">
                          <td><input className="ef-multi-input ef-multi-wide" type="text" placeholder="Item name"
                            value={row.item} onChange={e => updateMultiRow(idx, 'item', e.target.value)} /></td>
                          <td><select className="ef-multi-input ef-multi-cat" value={row.cat} onChange={e => updateMultiRow(idx, 'cat', e.target.value)}>
                            {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></td>
                          <td><input className="ef-multi-input ef-multi-num" type="number" step="0.01" min="0" placeholder="0.00"
                            value={row.amount} onChange={e => updateMultiRow(idx, 'amount', e.target.value)} /></td>
                          <td><input className="ef-multi-input ef-multi-sm" type="number" min="1"
                            value={row.qty} onChange={e => updateMultiRow(idx, 'qty', e.target.value)} /></td>
                          <td><input className="ef-multi-input ef-multi-date" type="date"
                            value={row.date} onChange={e => updateMultiRow(idx, 'date', e.target.value)} /></td>
                          <td><select className="ef-multi-input ef-multi-avb" value={row.avb} onChange={e => updateMultiRow(idx, 'avb', e.target.value)}>
                            {AVB_OPTIONS.map(o => <option key={o}>{o}</option>)}
                          </select></td>
                          <td><input className="ef-multi-input ef-multi-wide" type="text" placeholder="Optional"
                            value={row.vendor} onChange={e => updateMultiRow(idx, 'vendor', e.target.value)} /></td>
                          <td><button type="button" className="ef-multi-remove" onClick={() => removeMultiRow(idx)}
                            disabled={multiRows.length <= 1}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ef-multi-footer ef-modal-footer">
                  <button type="button" className="ef-multi-add-row" onClick={() => setMultiRows(prev => [...prev, makeEmptyRow(scholar.defaultSem)])}>
                    + Add another expense
                  </button>
                  <button type="submit"
                    disabled={filledRows.length === 0 || multiSubmitState === 'submitting'}
                    className={`ef-save${multiSubmitState === 'done' ? ' is-saved' : ''}`}>
                    {multiSubmitState === 'done' ? '✓ Submitted' : multiSubmitState === 'submitting' ? 'Submitting…' : `Submit ${filledRows.length > 0 ? filledRows.length + ' ' : ''}expense${filledRows.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ApprovedExpensesTable
          currentSem={currentSem}
          semExpenses={semExpenses}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          expandedGroups={expandedGroups}
          setExpandedGroups={setExpandedGroups}
          editingId={editingId}
          editDraft={editDraft}
          setEditDraft={setEditDraft}
          pendingDeletes={pendingDeletes}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onRequestDelete={requestDelete}
        />

        <ScholarIngestPanel
          id="scholar-expense-ingest"
          type="expenses"
          scholarKey={scholar.key}
          sem={currentSem}
        />
      </main>

      <ExpenseAskWidget scholarKey={scholar.key} sem={currentSem} />
    </div>
  );
}
