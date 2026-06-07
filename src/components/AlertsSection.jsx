import React from 'react';
import { NAMECLASS } from '../constants.js';

const TYPE_LABELS = {
  added:          'Added expense',
  edited:         'Edited expense',
  delete_request: 'Delete request',
};

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ActivityItem({ item, onApprove, onDeny, onMarkRead }) {
  return (
    <div className={`activity-item af-type-${item.type}`}>
      <div className="activity-item-hd">
        <span className={`scholar-tag ${NAMECLASS[item.scholar_key] || ''}`}>{item.scholar_key}</span>
        <span className={`activity-type-badge activity-type-${item.type}`}>
          {TYPE_LABELS[item.type] || item.type}
        </span>
        <span className="activity-time">{timeAgo(item.created_at)}</span>
        {item.type !== 'delete_request' && (
          <button className="alert-x" aria-label="Dismiss" onClick={() => onMarkRead([item.id])}>×</button>
        )}
      </div>

      {item.expense_data && (
        <div className="activity-item-body">
          <span className="activity-exp-name">{item.expense_data.item}</span>
          <span className="activity-exp-amt">
            ₱{Math.round((item.expense_data.amount || 0) * (item.expense_data.qty || 1)).toLocaleString('en-US')}
          </span>
          {item.expense_data.sem && <span className="activity-exp-sem">{item.expense_data.sem}</span>}
          {item.expense_data.cat && <span className="activity-exp-cat">{item.expense_data.cat}</span>}
        </div>
      )}

      {item.type === 'edited' && item.changes && (
        <div className="activity-changes">
          {Object.entries(item.changes).map(([field, [from, to]]) =>
            from !== to ? (
              <div key={field} className="activity-change-row">
                <span className="activity-change-field">{field}</span>
                <span className="activity-change-from">{String(from)}</span>
                <span className="activity-change-arrow">→</span>
                <span className="activity-change-to">{String(to)}</span>
              </div>
            ) : null
          )}
        </div>
      )}

      {item.type === 'delete_request' && (
        <div className="activity-del-actions">
          <button className="af-approve-btn" onClick={() => onApprove(item)}>Approve delete</button>
          <button className="af-deny-btn" onClick={() => onDeny(item)}>Deny</button>
        </div>
      )}
    </div>
  );
}

export function AlertsSection({ feed, onApprove, onDeny, onMarkRead, id, collapsed, onToggle }) {
  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">01</span> Scholar Updates
        <span className="eyebrow-rule" />
        {feed.length > 0 && (
          <button className="activity-clear-all" onClick={() => onMarkRead(feed.map(f => f.id))}>
            Clear all
          </button>
        )}
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">Expense changes from scholars</h2>
            <span className="section-note">
              {feed.length > 0 ? `${feed.length} pending` : 'Up to date'}
            </span>
          </div>
          <div className="activity-list">
            {feed.length === 0
              ? <div className="alert-empty"><span className="check">✓</span>No pending updates from scholars.</div>
              : feed.map(item => (
                  <ActivityItem
                    key={item.id}
                    item={item}
                    onApprove={onApprove}
                    onDeny={onDeny}
                    onMarkRead={onMarkRead}
                  />
                ))
            }
          </div>
        </>
      )}
    </section>
  );
}
