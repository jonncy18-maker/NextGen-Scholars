import React, { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { NAMECLASS } from '../constants.js';

const DL_CATS = ['Academic', 'Milestone', 'English', 'Visa', 'Travel', 'Licensure', 'Other'];
const DL_URGENCIES = ['now', 'soon', 'upcoming', 'future'];
const EMPTY_DRAFT = { event: '', scholar: 'claire', when: '', sort: '', cat: 'Academic', urgency: 'soon' };

function dlKey(d, i) {
  return d.id || `${d.sort || ''}_${d.scholar || ''}_${i}`;
}

function whenFromDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function DeadlinesSection({ id, collapsed, onToggle }) {
  const { D, scholarKeys } = useData();

  const [completedKeys, setCompletedKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ngs_dl_done') || '[]')); } catch { return new Set(); }
  });

  const [localEvents, setLocalEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_dl_local') || '[]'); } catch { return []; }
  });

  const [sheetsOverrides, setSheetsOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_dl_overrides') || '{}'); } catch { return {}; }
  });

  const [editingKey, setEditingKey] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState({ ...EMPTY_DRAFT });

  const sheetsEvents = D.deadlines || [];
  const allEvents = [
    ...sheetsEvents.map((d, i) => {
      const key = dlKey(d, i);
      const override = sheetsOverrides[key];
      return { ...d, ...(override || {}), _key: key, _local: false };
    }),
    ...localEvents.map(d => ({ ...d, _key: d.id, _local: true })),
  ].sort((a, b) => (a.sort || '').localeCompare(b.sort || ''));

  function toggleComplete(key) {
    setCompletedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem('ngs_dl_done', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function startEdit(d) {
    setEditingKey(d._key);
    setEditDraft({
      event: d.event || '',
      scholar: d.scholar || '',
      when: d.when || '',
      sort: d.sort || '',
      cat: d.cat || 'Academic',
      urgency: d.urgency || 'soon',
    });
  }

  function cancelEdit() { setEditingKey(null); setEditDraft({}); }

  function saveEdit(d) {
    if (d._local) {
      const updated = localEvents.map(e => e.id === d._key ? { ...e, ...editDraft } : e);
      setLocalEvents(updated);
      try { localStorage.setItem('ngs_dl_local', JSON.stringify(updated)); } catch {}
    } else {
      const updated = { ...sheetsOverrides, [d._key]: editDraft };
      setSheetsOverrides(updated);
      try { localStorage.setItem('ngs_dl_overrides', JSON.stringify(updated)); } catch {}
    }
    cancelEdit();
  }

  function deleteLocalEvent(eventId) {
    const updated = localEvents.filter(e => e.id !== eventId);
    setLocalEvents(updated);
    try { localStorage.setItem('ngs_dl_local', JSON.stringify(updated)); } catch {}
  }

  function handleAddEvent(e) {
    e.preventDefault();
    if (!addDraft.event.trim()) return;
    const newEvent = {
      ...addDraft,
      id: `local_dl_${Date.now()}`,
      when: addDraft.when || whenFromDate(addDraft.sort),
    };
    const updated = [...localEvents, newEvent];
    setLocalEvents(updated);
    try { localStorage.setItem('ngs_dl_local', JSON.stringify(updated)); } catch {}
    setAddDraft({ ...EMPTY_DRAFT });
    setShowAddForm(false);
  }

  const done = allEvents.filter(d => completedKeys.has(d._key)).length;

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">04</span> Critical Deadlines
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">On the calendar</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {done > 0 && <span className="section-note">{done} of {allEvents.length} complete</span>}
              <button
                className={`add-exp-btn${showAddForm ? ' is-open' : ''}`}
                onClick={() => setShowAddForm(v => !v)}
              >
                {showAddForm ? '✕ Cancel' : '+ Add Event'}
              </button>
            </div>
          </div>

          {showAddForm && (
            <div className="dl-add-card">
              <div className="dl-add-title">New Event</div>
              <form className="dl-add-form" onSubmit={handleAddEvent}>
                <div className="field">
                  <label>Event</label>
                  <input
                    type="text"
                    placeholder="e.g. Y3S1 Enrollment"
                    value={addDraft.event}
                    onChange={e => setAddDraft(d => ({ ...d, event: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Scholar</label>
                  <select value={addDraft.scholar} onChange={e => setAddDraft(d => ({ ...d, scholar: e.target.value }))}>
                    {scholarKeys.map(k => <option key={k} value={k}>{k}</option>)}
                    <option value="all">all</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={addDraft.sort}
                    onChange={e => setAddDraft(d => ({ ...d, sort: e.target.value, when: whenFromDate(e.target.value) }))}
                  />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={addDraft.cat} onChange={e => setAddDraft(d => ({ ...d, cat: e.target.value }))}>
                    {DL_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Urgency</label>
                  <select value={addDraft.urgency} onChange={e => setAddDraft(d => ({ ...d, urgency: e.target.value }))}>
                    {DL_URGENCIES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="add-exp-actions">
                  <button type="button" className="add-exp-cancel" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="add-exp-save" disabled={!addDraft.event.trim()}>Add event</button>
                </div>
              </form>
            </div>
          )}

          <div className="dl-card">
            <table className="dl">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Scholar</th>
                  <th>When</th>
                  <th>Category</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th className="dl-th-actions" />
                </tr>
              </thead>
              <tbody>
                {allEvents.map(d => {
                  const isDone = completedKeys.has(d._key);
                  const isEditing = editingKey === d._key;

                  if (isEditing) {
                    return (
                      <React.Fragment key={d._key}>
                        <tr className={isDone ? 'dl-row-done' : ''}>
                          <td colSpan={7} className="dl-edit-cell">
                            <div className="dl-edit-form">
                              <div className="field">
                                <label>Event</label>
                                <input value={editDraft.event} onChange={e => setEditDraft(v => ({ ...v, event: e.target.value }))} />
                              </div>
                              <div className="field">
                                <label>Scholar</label>
                                <select value={editDraft.scholar} onChange={e => setEditDraft(v => ({ ...v, scholar: e.target.value }))}>
                                  {scholarKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                  <option value="all">all</option>
                                </select>
                              </div>
                              <div className="field">
                                <label>Date</label>
                                <input
                                  type="date"
                                  value={editDraft.sort}
                                  onChange={e => setEditDraft(v => ({ ...v, sort: e.target.value, when: whenFromDate(e.target.value) }))}
                                />
                              </div>
                              <div className="field">
                                <label>Category</label>
                                <select value={editDraft.cat} onChange={e => setEditDraft(v => ({ ...v, cat: e.target.value }))}>
                                  {DL_CATS.map(c => <option key={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className="field">
                                <label>Urgency</label>
                                <select value={editDraft.urgency} onChange={e => setEditDraft(v => ({ ...v, urgency: e.target.value }))}>
                                  {DL_URGENCIES.map(u => <option key={u}>{u}</option>)}
                                </select>
                              </div>
                              <div className="dl-edit-actions">
                                <button className="exp-edit-save" onClick={() => saveEdit(d)}>Save</button>
                                <button className="exp-edit-cancel" onClick={cancelEdit}>Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  return (
                    <tr key={d._key} className={isDone ? 'dl-row-done' : ''}>
                      <td><span className="dl-event">{d.event}</span></td>
                      <td><span className={`scholar-tag ${NAMECLASS[d.scholar] || ''}`}>{d.scholar}</span></td>
                      <td className="dl-when">{d.when}</td>
                      <td className="dl-cat">{d.cat}</td>
                      <td><span className={`urg ${d.urgency}`}>{d.urgency}</span></td>
                      <td>
                        {isDone
                          ? <span className="dl-status-done">✓ Done</span>
                          : <button className="dl-mark-btn" onClick={() => toggleComplete(d._key)}>Mark done</button>
                        }
                      </td>
                      <td className="dl-actions-cell">
                        <button className="exp-edit-btn" onClick={() => startEdit(d)}>Edit</button>
                        {d._local && (
                          <button className="exp-del-btn" onClick={() => deleteLocalEvent(d._key)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {allEvents.length === 0 && (
                  <tr><td colSpan={7} className="dl-empty">No deadlines on the calendar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
