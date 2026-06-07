import React, { useState } from 'react';
import { NAMECLASS } from '../constants.js';

function AlertItem({ alert: a, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);

  function handleDismiss() {
    setDismissing(true);
    setTimeout(onDismiss, 400);
  }

  return (
    <div className={`alert ${a.severity}${dismissing ? ' dismissing' : ''}`}>
      <div className="alert-icon">{a.icon}</div>
      <div className="alert-body">
        <div className="alert-title">{a.title}</div>
        <div className="alert-sub">{a.sub}</div>
      </div>
      <div className="alert-meta">
        <span className={`scholar-tag ${NAMECLASS[a.scholar] || ''}`}>{a.scholar}</span>
        <button className="alert-x" aria-label="Dismiss" onClick={handleDismiss}>×</button>
      </div>
    </div>
  );
}

export function AlertsSection({ alerts, onDismiss, id, collapsed, onToggle }) {
  const live = alerts.filter(a => !a._dismissed);
  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">01</span> Escalations &amp; Alerts
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">What needs attention</h2>
            <span className="section-note">Dismiss as you resolve each item.</span>
          </div>
          <div className="alert-list">
            {live.length === 0
              ? <div className="alert-empty"><span className="check">✓</span>All clear — no open escalations.</div>
              : live.map(a => <AlertItem key={a.id} alert={a} onDismiss={() => onDismiss(a.id)} />)
            }
          </div>
        </>
      )}
    </section>
  );
}
