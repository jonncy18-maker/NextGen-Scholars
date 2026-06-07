import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useFmt } from '../../context/FxContext.jsx';
import { allExpenses } from '../../utils.js';
import { writeSent } from '../../supabase-writer.js';
import { FilterPanel } from './FilterPanel.jsx';
import { AddExpenseForm } from './AddExpenseForm.jsx';
import { TotalsRow, ChartSem, ChartCat } from './ExpenseCharts.jsx';
import { EMPTY_FILTERS, countActiveFilters, applyFilters, applySorting, groupExpenses, groupMultiLevel } from './filterHelpers.js';
import { EXPENSE_CATS } from '../../constants.js';
import { MultiGroupModal } from './MultiGroupModal.jsx';

const SINGLE_DIM_OPTIONS = [
  ['year',     'Year'],
  ['semester', 'Semester'],
  ['month',    'Month'],
  ['category', 'Category'],
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

export function ExpenseSection({ currency, addedExpenses, onAddExpense, onEditExpense, id, collapsed, onToggle }) {
  const $fmt = useFmt();
  const { D, scholarKeys } = useData();

  const [expScholar, setExpScholar] = useState(scholarKeys[0]);
  const [expView, setExpView]       = useState('sem');
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
  const [showAddForm, setShowAddForm] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  // Grouping state
  const [groupMode, setGroupMode]           = useState('none'); // 'none' | 'single' | 'multi'
  const [singleDim, setSingleDim]           = useState('month');
  const [multiDims, setMultiDims]           = useState([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  function handleMarkSent(r) {
    setSentAll(prev => {
      const updated = { ...prev, [expScholar]: [...new Set([...(prev[expScholar] || []), String(r.id)])] };
      try { localStorage.setItem('ngs_sent', JSON.stringify(updated)); } catch {}
      return updated;
    });
    writeSent(r.id, expScholar);
  }

  function handleDeleteExpense(r) {
    setDeletedAll(prev => {
      const updated = { ...prev, [expScholar]: [...new Set([...(prev[expScholar] || []), String(r.id)])] };
      try { localStorage.setItem('ngs_deleted', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  const s       = { ...D.scholars[expScholar], _key: expScholar };
  const sems    = Object.keys(s.expenses || {});
  const baseRows  = allExpenses(s);
  const localRows = (addedExpenses[expScholar] || []).map(e => ({ ...e, status: e.avb }));
  const allRows   = [...baseRows, ...localRows].filter(r => !deletedIds.has(String(r.id)));

  const uniqueCats    = EXPENSE_CATS;
  const uniqueStatuses = [...new Set(allRows.map(r => r.status))].sort();
  const uniqueSents   = [...new Set(allRows.map(r => r.sent).filter(Boolean).map(v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()))].sort();

  function startEdit(r) {
    setEditingId(r.id);
    setEditDraft({
      item:   r.item   || '',
      cat:    r.cat    || '',
      date:   r.date   || '',
      amount: String(r.amount || ''),
      qty:    String(r.qty    || 1),
      avb:    r.avb    || r.status || 'Actual',
      vendor: r.vendor || '',
    });
  }

  function cancelEdit() { setEditingId(null); setEditDraft({}); }

  function saveEdit(r) {
    const fields = {
      item:   editDraft.item.trim(),
      cat:    editDraft.cat,
      date:   editDraft.date,
      amount: parseFloat(editDraft.amount) || 0,
      qty:    parseInt(editDraft.qty, 10)  || 1,
      avb:    editDraft.avb,
      vendor: editDraft.vendor.trim(),
    };
    if (onEditExpense) onEditExpense(expScholar, r.id, fields);
    setEditingId(null);
    setEditDraft({});
  }

  function switchScholar(k) {
    setExpScholar(k);
    setExpSem('all');
    setExpSearch('');
    setFilters(EMPTY_FILTERS);
    setSortField(null);
    setSortDir('asc');
    setShowAddForm(false);
    setGroupMode('none');
    setMultiDims([]);
    setExpandedGroups(new Set());
    setEditingId(null);
    setEditDraft({});
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

  // Compute active groups
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

  function renderExpRow(r, i) {
    const isSent    = r.sent === 'Yes' || sentOverrides.has(String(r.id));
    const qty       = r.qty || 1;
    const total     = (r.amount || 0) * qty;
    const isEditing = editingId === r.id;

    if (isEditing) {
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
                  <select value={editDraft.cat} onChange={ev => setEditDraft(d => ({ ...d, cat: ev.target.value }))}>
                    {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="exp-edit-field">
                  <span>Amount (₱)</span>
                  <input type="number" step="0.01" min="0" value={editDraft.amount} onChange={ev => setEditDraft(d => ({ ...d, amount: ev.target.value }))} />
                </label>
                <label className="exp-edit-field">
                  <span>Qty</span>
                  <input type="number" min="1" value={editDraft.qty} onChange={ev => setEditDraft(d => ({ ...d, qty: ev.target.value }))} />
                </label>
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
                <div className="exp-edit-actions">
                  <button className="exp-edit-save" onClick={() => saveEdit(r)}>Save</button>
                  <button className="exp-edit-cancel" onClick={cancelEdit}>Cancel</button>
                </div>
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
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">03</span> Expense Dashboard
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">Where the investment goes</h2>
            <button
              className={`filter-toggle-btn${showFilters ? ' is-open' : ''}${activeFilters > 0 ? ' has-active' : ''}`}
              onClick={() => setShowFilters(v => !v)}
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

          <div className="exp-controls">
            <div className="tabs">
              {scholarKeys.map(k => (
                <button key={k} className={`tab${expScholar === k ? ' active' : ''}`} onClick={() => switchScholar(k)}>
                  {D.scholars[k].firstName}
                </button>
              ))}
            </div>
            <div className="exp-controls-right">
              <div className="viewtoggle">
                {[['sem', 'By Semester'], ['cat', 'By Category']].map(([v, lbl]) => (
                  <button key={v} className={expView === v ? 'active' : ''} onClick={() => setExpView(v)}>{lbl}</button>
                ))}
              </div>
              <button
                className={`add-exp-btn${showAddForm ? ' is-open' : ''}`}
                onClick={() => setShowAddForm(v => !v)}
              >
                {showAddForm ? '✕ Cancel' : '+ Add Expense'}
              </button>
            </div>
          </div>

          {showAddForm && (
            <AddExpenseForm
              scholar={expScholar}
              onAdd={(scholar, exp) => { onAddExpense(scholar, exp); }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          <TotalsRow s={s} currency={currency} />
          <div className="chart-card">
            {expView === 'sem'
              ? <ChartSem key={expScholar + '-sem'} s={s} currency={currency} extraRows={localRows} />
              : <ChartCat key={expScholar + '-cat'} s={s} currency={currency} extraRows={localRows} />
            }
          </div>

          {(() => {
            const pendingRows    = rows.filter(r => r.sent !== 'Yes');
            const pendingTotal   = pendingRows.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
            const allUnsent      = allRows.filter(r => r.sent !== 'Yes');
            const allUnsentTotal = allUnsent.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
            const isFiltered = activeFilters > 0;
            return (
              <div className="pending-send-card">
                <div className="pending-send-left">
                  <div className="pending-send-label">Pending to Send</div>
                  <div className="pending-send-note">
                    {isFiltered
                      ? `${pendingRows.length} item${pendingRows.length !== 1 ? 's' : ''} not yet sent · filtered view`
                      : `${pendingRows.length} item${pendingRows.length !== 1 ? 's' : ''} not yet sent · all rows`}
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
            );
          })()}

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

            {/* Grouping controls */}
            <div className="exp-groupmode">
              <span className="exp-groupmode-label">Group by</span>
              <div className="exp-groupmode-radios">
                <button
                  className={groupMode === 'none' ? 'active' : ''}
                  onClick={() => handleGroupModeClick('none')}
                >
                  No grouping
                </button>
                <button
                  className={groupMode === 'single' ? 'active' : ''}
                  onClick={() => handleGroupModeClick('single')}
                >
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
                  onChange={e => { setSingleDim(e.target.value); setCollapsedGroups(new Set()); }}
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
            </div>

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
                  : (
                    <tbody>
                      {rows.length === 0
                        ? <tr className="exp-none"><td colSpan={9}>No matching expenses.</td></tr>
                        : rows.map(renderExpRow)
                      }
                    </tbody>
                  )
                }
              </table>
            </div>
            {rows.length > 0 && (
              <div className="exp-count">{rows.length} row{rows.length !== 1 ? 's' : ''}</div>
            )}
          </div>
        </>
      )}

      {showMultiModal && (
        <MultiGroupModal
          currentDims={multiDims}
          onConfirm={handleMultiConfirm}
          onCancel={handleMultiCancel}
        />
      )}
    </section>
  );
}
