import React, { useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { writeActionToggle } from '../supabase-writer.js';
import { NAMECLASS } from '../constants.js';

export function ActionsSection({ id, collapsed, onToggle }) {
  const { D } = useData();
  const [checked, setChecked] = useState({});
  const actions = D.actions || [];
  const left = actions.length - Object.values(checked).filter(Boolean).length;

  function toggle(id) {
    const newDone = !checked[id];
    setChecked(c => ({ ...c, [id]: newDone }));
    writeActionToggle(id, newDone);
  }

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">05</span> Mentor Action Items
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">This week's checklist</h2>
            <span className="section-note">{left} of {actions.length} open</span>
          </div>
          <div className="actions-list">
            {actions.map(a => {
              const done = !!checked[a.id];
              return (
                <div key={a.id} className={`action${done ? ' done' : ''}`} onClick={() => toggle(a.id)}>
                  <span className="checkbox">✓</span>
                  <span className="action-text">{a.text}</span>
                  <span className={`scholar-tag ${NAMECLASS[a.scholar] || ''}`}>{a.scholar}</span>
                  <span className="action-cat">{a.cat}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
