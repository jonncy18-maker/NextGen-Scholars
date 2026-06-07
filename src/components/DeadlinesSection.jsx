import React from 'react';
import { useData } from '../context/DataContext.jsx';
import { NAMECLASS } from '../constants.js';

export function DeadlinesSection({ id, collapsed, onToggle }) {
  const { D } = useData();
  const sorted = [...(D.deadlines || [])].sort((a, b) => (a.sort || '').localeCompare(b.sort || ''));
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
          <div className="section-head"><h2 className="section-title">On the calendar</h2></div>
          <div className="dl-card">
            <table className="dl">
              <thead><tr><th>Event</th><th>Scholar</th><th>When</th><th>Category</th><th>Urgency</th></tr></thead>
              <tbody>
                {sorted.map((d, i) => (
                  <tr key={i}>
                    <td><span className="dl-event">{d.event}</span></td>
                    <td><span className={`scholar-tag ${NAMECLASS[d.scholar] || ''}`}>{d.scholar}</span></td>
                    <td className="dl-when">{d.when}</td>
                    <td className="dl-cat">{d.cat}</td>
                    <td><span className={`urg ${d.urgency}`}>{d.urgency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
