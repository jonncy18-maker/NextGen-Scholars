import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useFmt } from '../../context/FxContext.jsx';
import { allExpenses } from '../../utils.js';
import { writeSent } from '../../supabase-writer.js';
import { FilterPanel } from './FilterPanel.jsx';
import { TotalsRow } from './ExpenseCharts.jsx';
import { EMPTY_FILTERS, countActiveFilters, applyFilters, applySorting, groupExpenses, groupMultiLevel } from './filterHelpers.js';
import { EXPENSE_CATS, EXPENSE_BUCKETS, CAT_TO_BUCKET, SEMESTER_OPTIONS } from '../../constants.js';
import { MultiGroupModal } from './MultiGroupModal.jsx';

const SINGLE_DIM_OPTIONS = [
  ['year',     'Year'],
  ['semester', 'Semester'],
  ['month',    'Month'],
  ['category', 'Category'],
  ['bucket',   'Bucket'],
];

function SortTh({ label, field, sortField, sortDir, onSort, className }) {
  const active = sortField === field;
  const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      className={`sortable${active ? ' sort-active' : ''}${className ? ' ' + className : ''}`}
      onClick={() => onSort(field)}
      title={`Sort by ${label}`}
    >
      {label}{arrow}
    </th>
  );
}

export function ExpenseSection({ currency, addedExpenses, onAddExpense, onEditExpense, onDeleteExpense, id, collapsed, onToggle, workbenchSlot }) {
  const $fmt = useFmt();
  const { D, scholarKeys } = useData();
  const todayISO = new Date().toISOString().split('T')[0];

  const [expScholar, setExpScholar] = useState(scholarKeys[0]);
  const [expSearch, setExpSearch]   = useState('');
  const [expSem, setExpSem]         = useState('all');

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState(EMPTY_FILTERS);

  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir]     = useState('asc');

  const [sentAll, setSentAll] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_sent') || '{}'); } catch { return {}; }
  });
  const [deletedAll, setDeletedAll] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_deleted') || '{}'); } catch { return {}; }
  });
  const sentOverrides = new Set(sentAll[expScholar] || []);
  const deletedIds    = new Set(deletedAll[expScholar] || []);
  // Inline edit state
  const [editingId, setEditingId]   = useState(null);
  const [editDraft, setEditDraft]   = useState({});
  const [addDepositOpen, setAddDepositOpen] = useState(false);
  const [newDeposit, setNewDeposit] = useState({ amount: '', date: todayISO, sent: 'No' });
  // First-time split from edit: deposit table (replaces original amount)
  const [editSplitActive, setEditSplitActive]     = useState(false);
  const [editSplitDeposits, setEditSplitDeposits] = useState([]);

  // Grouping state
  const [groupMode, setGroupMode]           = useState('multi');
  const [singleDim, setSingleDim]           = useState('month');
  const [multiDims, setMultiDims]           = useState(['year', 'month']);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Split group collapse state (set = collapsed)
  const [expandedSplits, setExpandedSplits] = useState(new Set());

  const [dueView, setDueView] = useState(null);

  function handleMarkSent(r) {
    setSentAll(prev => {
      const updated = { ...prev, [expScholar]: [...new Set([...(prev[expScholar] || []), String(r.id)])] };
      try { localStorage.setItem('ngs_sent', JSON.stringify(updated)); } catch {}
      return updated;
    });
    writeSent(r.id, expScholar);
  }

  function handleUnsent(r) {
    setSentAll(prev => {
      const updated = { ...prev, [expScholar]: (prev[expScholar] || []).filter(id => id !== String(r.id)) };
      try { localStorage.setItem('ngs_sent', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (onEditExpense) onEditExpense(expScholar, r.id, { sent: 'No' });
  }

  function handleDeleteExpense(r) {
    setDeletedAll(prev => {
      const updated = { ...prev, [expScholar]: [...new Set([...(prev[expScholar] || []), String(r.id)])] };
      try { localStorage.setItem('ngs_deleted', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (onDeleteExpense) onDeleteExpense(expScholar, r.id);
  }

  const s       = { ...D.scholars[expScholar], _key: expScholar };
  const sems    = Object.keys(s.expenses || {});
  const baseRows  = allExpenses(s);
  const baseIds   = new Set(baseRows.map(r => String(r.id)));
  const localRows = (addedExpenses[expScholar] || [])
    .filter(e => !baseIds.has(String(e.id)))
    .map(e => ({ ...e, status: e.avb }));
  const allRows   = [...baseRows, ...localRows].filter(r => !deletedIds.has(String(r.id)));

  const uniqueCats     = EXPENSE_CATS;
  const uniqueStatuses = [...new Set(allRows.map(r => r.status))].sort();
  const uniqueSents    = [...new Set(allRows.map(r => r.sent).filter(Boolean).map(v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()))].sort();

  function startEdit(r) {
    setEditingId(r.id);
    setEditDraft({
      item:     r.item   || '',
      cat:      r.cat    || '',
      bucket:   r.bucket || CAT_TO_BUCKET[r.cat] || 'college',
      date:     r.date   || '',
      amount:   String(r.amount || ''),
      qty:      String(r.qty    || 1),
      avb:      r.avb    || r.status || 'Actual',
      vendor:   r.vendor || '',
      sem:      r.sem    || '',
      group_id: r.group_id || null,
    });
    setAddDepositOpen(false);
    setNewDeposit({ amount: '', date: todayISO, sent: 'No' });
    setEditSplitActive(false);
    setEditSplitDeposits([]);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({});
    setAddDepositOpen(false);
    setNewDeposit({ amount: '', date: todayISO, sent: 'No' });
    setEditSplitActive(false);
    setEditSplitDeposits([]);
  }

  function saveEdit(r) {
    const fields = {
      item:   editDraft.item.trim(),
      cat:    editDraft.cat,
      bucket: editDraft.bucket || CAT_TO_BUCKET[editDraft.cat] || 'college',
      date:   editDraft.date,
      amount: parseFloat(editDraft.amount) || 0,
      qty:    parseInt(editDraft.qty, 10)  || 1,
      avb:    editDraft.avb,
      vendor: editDraft.vendor.trim(),
      sem:    editDraft.sem.trim(),
    };
    if (editDraft.group_id) fields.group_id = editDraft.group_id;
    if (onEditExpense) onEditExpense(expScholar, r.id, fields);
    setEditingId(null);
    setEditDraft({});
    setAddDepositOpen(false);
    setNewDeposit({ amount: '', date: todayISO, sent: 'No' });
  }

  function startSplit(r) {
    // Open the deposit table — original row becomes Deposit 1
    setEditSplitActive(true);
    setEditSplitDeposits([
      { _id: Math.random().toString(36).slice(2), amount: '', date: r.date || todayISO, sent: r.sent || 'No' },
      { _id: Math.random().toString(36).slice(2), amount: '', date: todayISO, sent: 'No' },
    ]);
  }

  function handleSaveSplit(r) {
    const valid = editSplitDeposits.filter(d => d.amount && parseFloat(d.amount) > 0);
    if (valid.length < 2) return;
    const groupId = `grp_${Date.now()}`;
    const shared = {
      item:   editDraft.item.trim() || r.item,
      cat:    editDraft.cat  || r.cat,
      avb:    editDraft.avb  || r.avb || r.status || 'Actual',
      vendor: editDraft.vendor.trim() || r.vendor || '',
      sem:    editDraft.sem.trim()    || r.sem,
    };

    // Deposit 1 → update the original row in place
    if (onEditExpense) onEditExpense(expScholar, r.id, {
      ...shared,
      amount:   parseFloat(valid[0].amount),
      qty:      1,
      date:     valid[0].date,
      sent:     valid[0].sent,
      group_id: groupId,
    });

    // Deposits 2+ → create new rows
    valid.slice(1).forEach((d, i) => {
      if (onAddExpense) onAddExpense(expScholar, {
        id: `local_${Date.now()}_${i}`,
        ...shared,
        amount:   parseFloat(d.amount),
        qty:      1,
        date:     d.date,
        sent:     d.sent,
        group_id: groupId,
      });
    });

    setEditingId(null);
    setEditDraft({});
    setEditSplitActive(false);
    setEditSplitDeposits([]);
    setAddDepositOpen(false);
  }

  function handleSaveNewDeposit(r) {
    if (!newDeposit.amount || parseFloat(newDeposit.amount) <= 0) return;
    const groupId = editDraft.group_id;

    // Persist group_id on the original row if this is the first split
    if (!r.group_id && groupId) {
      if (onEditExpense) onEditExpense(expScholar, r.id, { group_id: groupId });
    }

    if (onAddExpense) onAddExpense(expScholar, {
      id:       `local_${Date.now()}`,
      item:     editDraft.item.trim() || r.item,
      cat:      editDraft.cat || r.cat,
      amount:   parseFloat(newDeposit.amount),
      qty:      1,
      date:     newDeposit.date,
      avb:      editDraft.avb || r.avb || r.status || 'Actual',
      sent:     newDeposit.sent,
      vendor:   editDraft.vendor.trim() || r.vendor || '',
      sem:      editDraft.sem.trim() || r.sem,
      group_id: groupId,
    });

    setAddDepositOpen(false);
    setNewDeposit({ amount: '', date: todayISO, sent: 'No' });
  }

  function switchScholar(k) {
    setExpScholar(k);
    setExpSem('all');
    setExpSearch('');
    setFilters(EMPTY_FILTERS);
    setSortField(null);
    setSortDir('asc');
    setShowAddForm(false);
    setGroupMode('multi');
    setMultiDims(['year', 'month']);
    setExpandedGroups(new Set());
    setExpandedSplits(new Set());
    setEditingId(null);
    setEditDraft({});
    setAddDepositOpen(false);
    setEditSplitActive(false);
    setEditSplitDeposits([]);
  }

  function handleGroupModeClick(mode) {
    if (mode === 'multi') {
      setShowMultiModal(true);
    } else {
      setGroupMode(mode);
      setExpandedGroups(new Set());
    }
  }

  function handleMultiConfirm(dims) {
    if (dims.length === 0) {
      setGroupMode('none');
      setMultiDims([]);
    } else {
      setMultiDims(dims);
      setGroupMode('multi');
    }
    setExpandedGroups(new Set());
    setShowMultiModal(false);
  }

  function handleMultiCancel() {
    setShowMultiModal(false);
  }

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleSplit(groupId) {
    setExpandedSplits(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }

  function handleSort(field) {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField(null); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setExpSearch('');
    setExpSem('all');
  }

  let rows = allRows;
  if (expSem !== 'all') rows = rows.filter(r => r.sem === expSem);
  if (expSearch) rows = rows.filter(r => (r.item + ' ' + r.cat).toLowerCase().includes(expSearch.toLowerCase()));
  rows = applyFilters(rows, filters);
  rows = applySorting(rows, sortField, sortDir);

  const activeFilters = countActiveFilters(filters) + (expSearch ? 1 : 0) + (expSem !== 'all' ? 1 : 0);

  let activeGroups = null;
  if (groupMode === 'single') {
    activeGroups = groupExpenses(rows, singleDim);
  } else if (groupMode === 'multi' && multiDims.length > 0) {
    activeGroups = groupMultiLevel(rows, multiDims);
  }

  function countGroupRows(group) {
    if (group.rows) return group.rows.length;
    return (group.subgroups || []).reduce((s, g) => s + countGroupRows(g), 0);
  }

  // Build flat display list, grouping split-deposit rows together
  function buildDisplayItems(rows) {
    const seenGroups = new Set();
    const result = [];
    for (const r of rows) {
      if (!r.group_id) {
        result.push({ type: 'row', row: r });
      } else if (!seenGroups.has(r.group_id)) {
        seenGroups.add(r.group_id);
        result.push({ type: 'split', rows: rows.filter(x => x.group_id === r.group_id) });
      }
    }
    return result;
  }

  function renderExpRow(r, i) {
    const isSent    = r.sent === 'Yes' || sentOverrides.has(String(r.id));
    const qty       = r.qty || 1;
    const total     = (r.amount || 0) * qty;
    const isEditing = editingId === r.id;

    if (isEditing) {
      // Compute sibling deposits for the split section
      const groupId  = editDraft.group_id;
      const siblings = groupId ? allRows.filter(x => x.group_id === groupId) : [];

      return (
        <React.Fragment key={r.id || i}>
          <tr>
            <td><span className="exp-item">{r.item}</span></td>
            <td><span className="exp-cat">{r.cat}</span></td>
            <td className="exp-date">{r.date}</td>
            <td className="right exp-amount">{$fmt(r.amount, currency)}</td>
            <td className="right exp-qty exp-col-hide-mobile">{qty}</td>
            <td className="right exp-total">{$fmt(total, currency)}</td>
            <td><span className={`exp-status ${r.status}`}>{r.status}</span></td>
            <td><span className="exp-sent is-yes">editing…</span></td>
            <td className="exp-del-cell">
              <button className="exp-del-btn" onClick={cancelEdit}>Cancel</button>
            </td>
          </tr>
          <tr className="exp-edit-row">
            <td colSpan={9}>
              <div className="exp-edit-form">
                <label className="exp-edit-field">
                  <span>Item</span>
                  <input value={editDraft.item} onChange={ev => setEditDraft(d => ({ ...d, item: ev.target.value }))} />
                </label>
                <label className="exp-edit-field">
                  <span>Category</span>
                  <select value={editDraft.cat} onChange={ev => setEditDraft(d => ({
                    ...d,
                    cat: ev.target.value,
                    bucket: CAT_TO_BUCKET[ev.target.value] || d.bucket || 'college',
                  }))}>
                    {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="exp-edit-field">
                  <span>Bucket</span>
                  <select value={editDraft.bucket || 'college'} onChange={ev => setEditDraft(d => ({ ...d, bucket: ev.target.value }))}>
                    {EXPENSE_BUCKETS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </label>
                {!editSplitActive && (
                  <label className="exp-edit-field">
                    <span>Amount (₱)</span>
                    <input type="number" step="0.01" min="0" value={editDraft.amount} onChange={ev => setEditDraft(d => ({ ...d, amount: ev.target.value }))} />
                  </label>
                )}
                {!editSplitActive && (
                  <label className="exp-edit-field">
                    <span>Qty</span>
                    <input type="number" min="1" value={editDraft.qty} onChange={ev => setEditDraft(d => ({ ...d, qty: ev.target.value }))} />
                  </label>
                )}
                {editSplitActive && (
                  <label className="exp-edit-field">
                    <span>Amount (₱)</span>
                    <div className="split-amount-display">
                      <span className="split-amount-total">Splitting…</span>
                      <span className="split-amount-note">set amounts below</span>
                    </div>
                  </label>
                )}
                <label className="exp-edit-field">
                  <span>Date</span>
                  <input type="date" value={editDraft.date} onChange={ev => setEditDraft(d => ({ ...d, date: ev.target.value }))} />
                </label>
                <label className="exp-edit-field">
                  <span>Status</span>
                  <select value={editDraft.avb} onChange={ev => setEditDraft(d => ({ ...d, avb: ev.target.value }))}>
                    <option value="Actual">Actual</option>
                    <option value="Budget">Budget</option>
                  </select>
                </label>
                <label className="exp-edit-field">
                  <span>Vendor</span>
                  <input value={editDraft.vendor} onChange={ev => setEditDraft(d => ({ ...d, vendor: ev.target.value }))} />
                </label>
                <label className="exp-edit-field">
                  <span>Semester</span>
                  <select value={editDraft.sem} onChange={ev => setEditDraft(d => ({ ...d, sem: ev.target.value }))}>
                    {SEMESTER_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <div className="exp-edit-actions">
                  {editSplitActive
                    ? <span className="exp-edit-split-hint-inline">Use “Save split” below ↓</span>
                    : <button className="exp-edit-save" onClick={() => saveEdit(r)}>Save</button>
                  }
                  <button className="exp-edit-cancel" onClick={cancelEdit}>Cancel</button>
                  {!editSplitActive && (r.sent === 'Yes' || sentOverrides.has(String(r.id))) && (
                    <button className="exp-edit-unsend" onClick={() => handleUnsent(r)}>Unsend</button>
                  )}
                </div>
              </div>

              {/* ── Split deposits section ── */}
              <div className="exp-edit-split-section">
                <div className="exp-edit-split-header">
                  {groupId ? `Deposits (${siblings.length})` : 'Split into deposits'}
                </div>

                {/* ── First-time split: full deposit table ── */}
                {!groupId && editSplitActive && (() => {
                  const refAmt   = parseFloat(editDraft.amount) || r.amount || 0;
                  const allocated = editSplitDeposits
                    .filter(d => d.amount && parseFloat(d.amount) > 0)
                    .reduce((s, d) => s + parseFloat(d.amount), 0);
                  const diff     = refAmt - allocated;
                  const balanced = Math.abs(diff) < 0.01;
                  const over     = diff < -0.01;
                  const validDeps = editSplitDeposits.filter(d => d.amount && parseFloat(d.amount) > 0);
                  return (
                    <>
                      <div className="exp-edit-split-ref">
                        Reference total: <strong>{$fmt(refAmt, currency)}</strong>
                        <span className={`exp-edit-split-diff${balanced ? ' is-balanced' : over ? ' is-over' : ''}`}>
                          {balanced
                            ? ' · ✓ balanced'
                            : over
                              ? ` · ${$fmt(Math.abs(diff), currency)} over`
                              : ` · ${$fmt(diff, currency)} remaining`}
                        </span>
                      </div>
                      <div className="split-deposits-header">
                        <span>Amount (₱)</span><span>Date</span><span>Sent</span><span></span>
                      </div>
                      {editSplitDeposits.map(d => (
                        <div key={d._id} className="split-deposit-row">
                          <input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={d.amount}
                            onChange={e => setEditSplitDeposits(ds => ds.map(x => x._id === d._id ? { ...x, amount: e.target.value } : x))}
                          />
                          <input
                            type="date" value={d.date}
                            onChange={e => setEditSplitDeposits(ds => ds.map(x => x._id === d._id ? { ...x, date: e.target.value } : x))}
                          />
                          <select value={d.sent}
                            onChange={e => setEditSplitDeposits(ds => ds.map(x => x._id === d._id ? { ...x, sent: e.target.value } : x))}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                          <button
                            type="button" className="split-deposit-remove"
                            onClick={() => setEditSplitDeposits(ds => ds.length > 2 ? ds.filter(x => x._id !== d._id) : ds)}
                            disabled={editSplitDeposits.length <= 2}
                          >×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button" className="split-deposit-add-btn"
                          onClick={() => setEditSplitDeposits(ds => [...ds, { _id: Math.random().toString(36).slice(2), amount: '', date: todayISO, sent: 'No' }])}
                        >+ Add deposit</button>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                          {validDeps.length < 2 && (
                            <span className="exp-edit-split-need">Enter at least 2 deposit amounts</span>
                          )}
                          <button
                            type="button" className="exp-edit-save"
                            style={{ fontSize: 12, padding: '7px 14px' }}
                            onClick={() => handleSaveSplit(r)}
                            disabled={validDeps.length < 2}
                          >Save split</button>
                          <button
                            type="button" className="exp-edit-cancel"
                            onClick={() => { setEditSplitActive(false); setEditSplitDeposits([]); }}
                          >Cancel</button>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* ── Button to trigger first-time split ── */}
                {!groupId && !editSplitActive && (
                  <button type="button" className="exp-edit-split-btn" onClick={() => startSplit(r)}>
                    ⊹ Split this expense into deposits
                  </button>
                )}

                {/* ── Already split: siblings list + add another ── */}
                {groupId && siblings.length > 0 && (
                  <div className="exp-edit-split-siblings">
                    {siblings.map(s => {
                      const sIsSent = s.sent === 'Yes' || sentOverrides.has(String(s.id));
                      return (
                        <div key={s.id} className={`exp-edit-split-sibling${s.id === r.id ? ' is-current' : ''}`}>
                          <span className="exp-edit-split-s-date">{s.date}</span>
                          <span className="exp-edit-split-s-amt">{$fmt(s.amount, currency)}</span>
                          <span className={`exp-sent ${sIsSent ? 'is-yes' : 'is-no'}`}>{sIsSent ? '✓ Sent' : 'Not sent'}</span>
                          {s.id === r.id && <span className="exp-edit-split-current-label">← this</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {groupId && !addDepositOpen && (
                  <button type="button" className="exp-edit-split-add-btn" onClick={() => setAddDepositOpen(true)}>
                    + Add another deposit
                  </button>
                )}

                {addDepositOpen && (
                  <div className="exp-edit-add-deposit-form">
                    <label className="exp-edit-field">
                      <span>Amount (₱)</span>
                      <input
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={newDeposit.amount}
                        onChange={e => setNewDeposit(d => ({ ...d, amount: e.target.value }))}
                        autoFocus
                      />
                    </label>
                    <label className="exp-edit-field">
                      <span>Date</span>
                      <input
                        type="date" value={newDeposit.date}
                        onChange={e => setNewDeposit(d => ({ ...d, date: e.target.value }))}
                      />
                    </label>
                    <label className="exp-edit-field">
                      <span>Sent</span>
                      <select value={newDeposit.sent} onChange={e => setNewDeposit(d => ({ ...d, sent: e.target.value }))}>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </label>
                    <div className="exp-edit-field">
                      <span>&nbsp;</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button" className="exp-edit-save"
                          style={{ padding: '7px 14px', fontSize: 12 }}
                          onClick={() => handleSaveNewDeposit(r)}
                          disabled={!newDeposit.amount || parseFloat(newDeposit.amount) <= 0}
                        >Add</button>
                        <button
                          type="button" className="exp-edit-cancel"
                          onClick={() => { setAddDepositOpen(false); setNewDeposit({ amount: '', date: todayISO, sent: 'No' }); }}
                        >Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </td>
          </tr>
        </React.Fragment>
      );
    }

    return (
      <tr key={r.id || i}>
        <td><span className="exp-item">{r.item}</span></td>
        <td><span className="exp-cat">{r.cat}</span></td>
        <td className="exp-date">{r.date}</td>
        <td className="right exp-amount">{$fmt(r.amount, currency)}</td>
        <td className="right exp-qty exp-col-hide-mobile">{qty}</td>
        <td className="right exp-total">{$fmt(total, currency)}</td>
        <td><span className={`exp-status ${r.status}`}>{r.status}</span></td>
        <td>
          {isSent
            ? <span className="exp-sent is-yes">✓ Sent</span>
            : <button className="exp-sent is-no mark-sent-btn" title="Mark as sent" onClick={() => handleMarkSent(r)}>Mark Sent →</button>
          }
        </td>
        <td className="exp-del-cell">
          <button className="exp-edit-btn" title="Edit expense" onClick={() => startEdit(r)}>Edit</button>
          <button className="exp-del-btn" title="Delete expense" onClick={() => handleDeleteExpense(r)}>Delete</button>
        </td>
      </tr>
    );
  }

  // Render a split deposit group (collapsed or expanded with individual deposit rows)
  function renderSplitGroup(groupRows) {
    const g       = groupRows[0];
    const groupId = g.group_id;
    const isCollapsed = expandedSplits.has(groupId);
    const total     = groupRows.reduce((s, r) => s + (r.amount || 0) * (r.qty || 1), 0);
    const sentCount = groupRows.filter(r => r.sent === 'Yes' || sentOverrides.has(String(r.id))).length;

    return (
      <React.Fragment key={groupId}>
        <tr className="exp-split-hd" onClick={() => toggleSplit(groupId)}>
          <td colSpan={2}>
            <div className="exp-split-hd-inner">
              <span className="exp-split-arrow">{isCollapsed ? '▶' : '▼'}</span>
              <span className="exp-item">{g.item}</span>
              <span className="exp-cat">{g.cat}</span>
              <span className="exp-split-badge">{groupRows.length} deposits</span>
            </div>
          </td>
          <td className="exp-date"></td>
          <td className="right"></td>
          <td className="right exp-col-hide-mobile"></td>
          <td className="right exp-split-total">{$fmt(total, currency)}</td>
          <td><span className="exp-split-sent-summary">{sentCount}/{groupRows.length} sent</span></td>
          <td></td>
          <td></td>
        </tr>
        {!isCollapsed && groupRows.map((r, i) => {
          // Show full edit form if this deposit is being edited
          if (editingId === r.id) return renderExpRow(r, i);
          const isSent   = r.sent === 'Yes' || sentOverrides.has(String(r.id));
          const qty      = r.qty || 1;
          const rowTotal = (r.amount || 0) * qty;
          return (
            <tr key={r.id} className="exp-split-deposit-row">
              <td><span className="exp-split-deposit-num">↳ {i + 1}</span></td>
              <td></td>
              <td className="exp-date">{r.date}</td>
              <td className="right exp-amount">{$fmt(r.amount, currency)}</td>
              <td className="right exp-qty exp-col-hide-mobile">{qty}</td>
              <td className="right exp-total">{$fmt(rowTotal, currency)}</td>
              <td><span className={`exp-status ${r.status || r.avb}`}>{r.status || r.avb}</span></td>
              <td>
                {isSent
                  ? <span className="exp-sent is-yes">✓ Sent</span>
                  : <button className="exp-sent is-no mark-sent-btn" onClick={() => handleMarkSent(r)}>Mark Sent →</button>
                }
              </td>
              <td className="exp-del-cell">
                <button className="exp-edit-btn" onClick={() => startEdit(r)}>Edit</button>
                <button className="exp-del-btn" onClick={() => handleDeleteExpense(r)}>Delete</button>
              </td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  }

  function renderGroupRows(groups, depth) {
    return groups.map(group => {
      const isCollapsed = !expandedGroups.has(group.key);
      const rowCount    = countGroupRows(group);
      const indent      = depth * 18;
      const depthCls    = `exp-group-depth-${depth}`;
      return (
        <React.Fragment key={group.key}>
          <tbody>
            <tr className={`exp-group-hd ${depthCls}`} onClick={() => toggleGroup(group.key)}>
              <td colSpan={9}>
                <div className="exp-group-hd-inner" style={{ paddingLeft: 14 + indent }}>
                  <span className="exp-group-arrow">{isCollapsed ? '▶' : '▼'}</span>
                  <span className="exp-group-label">{group.label}</span>
                  <span className="exp-group-meta">{rowCount} item{rowCount !== 1 ? 's' : ''}</span>
                  <span className="exp-group-total">{$fmt(group.total, currency)}</span>
                </div>
              </td>
            </tr>
          </tbody>
          {!isCollapsed && (
            group.subgroups
              ? renderGroupRows(group.subgroups, depth + 1)
              : (
                <tbody>
                  {group.rows.map(renderExpRow)}
                  <tr className="exp-subtotal">
                    <td colSpan={5} style={{ paddingLeft: 14 + indent }} className="exp-subtotal-label">
                      Subtotal — {group.label}
                    </td>
                    <td className="right exp-subtotal-amt">{$fmt(group.total, currency)}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              )
          )}
        </React.Fragment>
      );
    });
  }

  return (
    <div className="exp-module" id={id}>
      <div className="exp-controls">
        <div className="tabs">
          {scholarKeys.map(k => (
            <button key={k} className={`tab${expScholar === k ? ' active' : ''}`} onClick={() => switchScholar(k)}>
              {D.scholars[k].firstName}
            </button>
          ))}
        </div>
      </div>

      {(() => {
            const pendingRows    = rows.filter(r => r.sent !== 'Yes' && !sentOverrides.has(String(r.id)));
            const pendingTotal   = pendingRows.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
            const allUnsent      = allRows.filter(r => r.sent !== 'Yes' && !sentOverrides.has(String(r.id)));
            const allUnsentTotal = allUnsent.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
            const isFiltered = activeFilters > 0;

            const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
            const MS_DAY  = 86400000;
            const dayOffset = r => {
              if (!r.date) return null;
              const d = new Date(r.date + 'T00:00:00'); d.setHours(0,0,0,0);
              return Math.round((d.getTime() - todayMs) / MS_DAY);
            };
            const dueNowRows  = pendingRows.filter(r => { const o = dayOffset(r); return o !== null && o >= 0 && o <= 2; });
            const weekOutRows = pendingRows.filter(r => { const o = dayOffset(r); return o !== null && o >= 3 && o <= 7; });
            const dueNowTotal  = dueNowRows.reduce((t, r)  => t + (r.amount || 0) * (r.qty || 1), 0);
            const weekOutTotal = weekOutRows.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);

            const activeList = dueView === 'now' ? dueNowRows : dueView === 'week' ? weekOutRows : [];

            return (
              <>
                <div className="pending-send-card">
                  <div className="pending-send-left">
                    <div className="pending-send-label">Pending to Send</div>
                    <div className="pending-send-note">
                      {isFiltered
                        ? `${pendingRows.length} item${pendingRows.length !== 1 ? 's' : ''} not yet sent · filtered view`
                        : `${pendingRows.length} item${pendingRows.length !== 1 ? 's' : ''} not yet sent · all rows`}
                    </div>
                    <div className="pending-send-due-btns">
                      <button
                        className={`pending-send-due-btn${dueView === 'now' ? ' active' : ''}`}
                        onClick={() => setDueView(v => v === 'now' ? null : 'now')}
                        title="Today, tomorrow, and the day after"
                      >
                        Due Now{dueNowRows.length > 0 ? ` (${dueNowRows.length})` : ''}
                      </button>
                      <button
                        className={`pending-send-due-btn${dueView === 'week' ? ' active' : ''}`}
                        onClick={() => setDueView(v => v === 'week' ? null : 'week')}
                        title="Due in 3–7 days"
                      >
                        1 Week Out{weekOutRows.length > 0 ? ` (${weekOutRows.length})` : ''}
                      </button>
                    </div>
                  </div>
                  <div className="pending-send-right">
                    <div className="pending-send-amount">{$fmt(pendingTotal, currency)}</div>
                    {isFiltered && allUnsentTotal !== pendingTotal && (
                      <div className="pending-send-allnote">
                        {$fmt(allUnsentTotal, currency)} total unfiltered
                      </div>
                    )}
                  </div>
                </div>
                {dueView && (
                  <div className="pending-due-list">
                    <div className="pending-due-list-header">
                      <span className="pending-due-list-title">
                        {dueView === 'now' ? 'Due Now — next 3 days' : '1 Week Out — days 3–7'}
                      </span>
                      <span className="pending-due-list-total">{$fmt(dueView === 'now' ? dueNowTotal : weekOutTotal, currency)}</span>
                    </div>
                    {activeList.length === 0 ? (
                      <div className="pending-due-empty">No expenses in this window.</div>
                    ) : (
                      <div className="pending-due-rows">
                        {activeList.map(r => {
                          const offset = dayOffset(r);
                          const dayLabel = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : offset === 2 ? 'Day after tomorrow' : `In ${offset} days`;
                          return (
                            <div key={r.id} className="pending-due-row">
                              <span className="pending-due-day">{dayLabel}</span>
                              <span className="pending-due-item">{r.item}</span>
                              <span className="pending-due-cat">{r.cat}</span>
                              <span className="pending-due-amt">{$fmt((r.amount || 0) * (r.qty || 1), currency)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

      <TotalsRow s={s} currency={currency} />

      {workbenchSlot?.(expScholar)}

          <div className="exp-table-card">
            <div className="exp-toolbar">
              <input type="text" placeholder="Search items…" value={expSearch} onChange={e => setExpSearch(e.target.value)} />
              <select value={expSem} onChange={e => setExpSem(e.target.value)}>
                <option value="all">All semesters</option>
                {sems.map(sem => <option key={sem} value={sem}>{sem}</option>)}
              </select>
              {activeFilters > 0 && (
                <button className="exp-clear-btn" onClick={clearFilters}>Clear filters</button>
              )}
            </div>

            {/* Grouping controls (left) + Filter toggle (right) */}
            <div className="exp-groupmode">
              <span className="exp-groupmode-label">Group by</span>
              <div className="exp-groupmode-radios">
                <button className={groupMode === 'none' ? 'active' : ''} onClick={() => handleGroupModeClick('none')}>
                  No grouping
                </button>
                <button className={groupMode === 'single' ? 'active' : ''} onClick={() => handleGroupModeClick('single')}>
                  Single
                </button>
                <button
                  className={groupMode === 'multi' ? 'active' : ''}
                  onClick={() => handleGroupModeClick('multi')}
                  title={groupMode === 'multi' ? 'Edit grouping levels' : 'Configure multi-level grouping'}
                >
                  Multiple
                </button>
              </div>

              {groupMode === 'single' && (
                <select
                  className="exp-groupmode-single-select"
                  value={singleDim}
                  onChange={e => { setSingleDim(e.target.value); setExpandedGroups(new Set()); }}
                >
                  {SINGLE_DIM_OPTIONS.map(([v, lbl]) => (
                    <option key={v} value={v}>{lbl}</option>
                  ))}
                </select>
              )}

              {groupMode === 'multi' && multiDims.length > 0 && (
                <div className="exp-groupmode-multi-indicator">
                  <span className="exp-groupmode-multi-dims">
                    {multiDims.map((d, i) => {
                      const lbl = SINGLE_DIM_OPTIONS.find(([v]) => v === d)?.[1] || d;
                      return (
                        <React.Fragment key={d}>
                          {i > 0 && <span className="exp-groupmode-multi-sep"> › </span>}
                          {lbl}
                        </React.Fragment>
                      );
                    })}
                  </span>
                  <button className="exp-groupmode-edit-btn" onClick={() => setShowMultiModal(true)}>Edit</button>
                </div>
              )}

              <button
                className={`filter-toggle-btn${showFilters ? ' is-open' : ''}${activeFilters > 0 ? ' has-active' : ''}`}
                onClick={() => setShowFilters(v => !v)}
                style={{ marginLeft: 'auto' }}
              >
                {showFilters ? '▲' : '▼'} Filters{activeFilters > 0 ? ` · ${activeFilters} active` : ''}
              </button>
            </div>

            {showFilters && (
              <FilterPanel
                filters={filters}
                setFilters={setFilters}
                uniqueCats={uniqueCats}
                uniqueStatuses={uniqueStatuses}
                uniqueSents={uniqueSents}
                onClear={clearFilters}
              />
            )}

            <div className="exp-table-scroll">
              <table className="exp">
                <thead>
                  <tr>
                    <SortTh label="Item"       field="item"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Category"   field="cat"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Date"       field="date"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Unit Price" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right" />
                    <SortTh label="Qty"        field="qty"    sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right exp-col-hide-mobile" />
                    <SortTh label="Total"      field="total"  sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right" />
                    <SortTh label="Status"     field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Sent"       field="sent"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="exp-th-del" />
                  </tr>
                </thead>
                {activeGroups
                  ? renderGroupRows(activeGroups, 0)
                  : (() => {
                      const displayItems = buildDisplayItems(rows);
                      return (
                        <tbody>
                          {displayItems.length === 0
                            ? <tr className="exp-none"><td colSpan={9}>No matching expenses.</td></tr>
                            : displayItems.map((item, i) =>
                                item.type === 'split'
                                  ? renderSplitGroup(item.rows)
                                  : renderExpRow(item.row, i)
                              )
                          }
                        </tbody>
                      );
                    })()
                }
              </table>
            </div>
            {rows.length > 0 && (
              <div className="exp-count">{rows.length} row{rows.length !== 1 ? 's' : ''}</div>
            )}
          </div>
      {showMultiModal && (
        <MultiGroupModal
          currentDims={multiDims}
          onConfirm={handleMultiConfirm}
          onCancel={handleMultiCancel}
        />
      )}
    </div>
  );
}
