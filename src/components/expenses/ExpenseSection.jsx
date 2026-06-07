import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useFmt } from '../../context/FxContext.jsx';
import { allExpenses } from '../../utils.js';
import { writeSent } from '../../supabase-writer.js';
import { FilterPanel } from './FilterPanel.jsx';
import { AddExpenseForm } from './AddExpenseForm.jsx';
import { TotalsRow, ChartSem, ChartCat } from './ExpenseCharts.jsx';
import { EMPTY_FILTERS, countActiveFilters, applyFilters, applySorting, groupExpenses } from './filterHelpers.js';

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

export function ExpenseSection({ currency, addedExpenses, onAddExpense }) {
  const $fmt = useFmt();
  const { D, scholarKeys } = useData();

  const [expScholar, setExpScholar] = useState(scholarKeys[0]);
  const [expView, setExpView] = useState('sem');
  const [expSearch, setExpSearch] = useState('');
  const [expSem, setExpSem] = useState('all');

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [sentAll, setSentAll] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_sent') || '{}'); } catch { return {}; }
  });
  const [deletedAll, setDeletedAll] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_deleted') || '{}'); } catch { return {}; }
  });
  const sentOverrides = new Set(sentAll[expScholar] || []);
  const deletedIds = new Set(deletedAll[expScholar] || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [groupBy, setGroupBy] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

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

  const s = { ...D.scholars[expScholar], _key: expScholar };
  const sems = Object.keys(s.expenses || {});

  const baseRows = allExpenses(s);
  const localRows = (addedExpenses[expScholar] || []).map(e => ({ ...e, status: e.avb }));
  const allRows = [...baseRows, ...localRows].filter(r => !deletedIds.has(String(r.id)));

  const uniqueCats = [...new Set(allRows.map(r => r.cat))].sort();
  const uniqueStatuses = [...new Set(allRows.map(r => r.status))].sort();
  const uniqueSents = [...new Set(allRows.map(r => r.sent).filter(Boolean))].sort();

  function switchScholar(k) {
    setExpScholar(k);
    setExpSem('all');
    setExpSearch('');
    setFilters(EMPTY_FILTERS);
    setSortField(null);
    setSortDir('asc');
    setShowAddForm(false);
    setGroupBy('none');
    setCollapsedGroups(new Set());
  }

  function handleGroupBy(mode) {
    setGroupBy(mode);
    setCollapsedGroups(new Set());
  }

  function toggleGroup(key) {
    setCollapsedGroups(prev => {
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
  const groups = groupExpenses(rows, groupBy);

  const GROUP_BY_OPTIONS = [
    ['none', 'None'],
    ['month', 'Month'],
    ['category', 'Category'],
    ['year', 'Year'],
    ['semester', 'Semester'],
  ];

  function renderExpRow(r, i) {
    const isSent = r.sent === 'Yes' || sentOverrides.has(String(r.id));
    const qty = r.qty || 1;
    const total = (r.amount || 0) * qty;
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
          <button className="exp-del-btn" title="Delete expense" onClick={() => handleDeleteExpense(r)}>Delete</button>
        </td>
      </tr>
    );
  }

  return (
    <section className="section">
      <div className="eyebrow"><span className="num">03</span> Expense Dashboard <span className="eyebrow-rule" /></div>
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
        const pendingRows = rows.filter(r => r.sent !== 'Yes');
        const pendingTotal = pendingRows.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
        const allUnsent = allRows.filter(r => r.sent !== 'Yes');
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
        <div className="exp-groupby">
          <span className="exp-groupby-label">Group by</span>
          <div className="exp-groupby-chips">
            {GROUP_BY_OPTIONS.map(([val, lbl]) => (
              <button key={val} className={groupBy === val ? 'active' : ''} onClick={() => handleGroupBy(val)}>{lbl}</button>
            ))}
          </div>
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
            {groups
              ? groups.map(group => {
                  const collapsed = collapsedGroups.has(group.key);
                  return (
                    <React.Fragment key={group.key}>
                      <tbody>
                        <tr className="exp-group-hd" onClick={() => toggleGroup(group.key)}>
                          <td colSpan={9}>
                            <div className="exp-group-hd-inner">
                              <span className="exp-group-arrow">{collapsed ? '▶' : '▼'}</span>
                              <span className="exp-group-label">{group.label}</span>
                              <span className="exp-group-meta">{group.rows.length} item{group.rows.length !== 1 ? 's' : ''}</span>
                              <span className="exp-group-total">{$fmt(group.total, currency)}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                      {!collapsed && (
                        <tbody>
                          {group.rows.map(renderExpRow)}
                          <tr className="exp-subtotal">
                            <td colSpan={5} className="exp-subtotal-label">Subtotal — {group.label}</td>
                            <td className="right exp-subtotal-amt">{$fmt(group.total, currency)}</td>
                            <td colSpan={3} />
                          </tr>
                        </tbody>
                      )}
                    </React.Fragment>
                  );
                })
              : <tbody>
                  {rows.length === 0
                    ? <tr className="exp-none"><td colSpan={9}>No matching expenses.</td></tr>
                    : rows.map(renderExpRow)
                  }
                </tbody>
            }
          </table>
        </div>
        {rows.length > 0 && (
          <div className="exp-count">{rows.length} row{rows.length !== 1 ? 's' : ''}</div>
        )}
      </div>
    </section>
  );
}
