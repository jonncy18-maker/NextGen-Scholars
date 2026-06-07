import React, { useState } from 'react';

const TYPE_LABELS = {
  added:          'Added',
  edited:         'Edited',
  delete_request: 'Delete request',
};

const TYPE_CLASSES = {
  added:          'af-added',
  edited:         'af-edited',
  delete_request: 'af-delete',
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

export function ActivityFeed({ feed, onApprove, onDeny, onMarkRead }) {
  const [open, setOpen] = useState(false);

  const unread = feed.length;

  function handleMarkAll() {
    onMarkRead(feed.map(f => f.id));
    setOpen(false);
  }

  return (
    <div className="af-root">
      <button
        className={`af-bell${unread > 0 ? ' has-unread' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Scholar activity"
      >
        <span className="af-bell-icon">&#9432;</span>
        <span className="af-bell-label">Activity</span>
        {unread > 0 && <span className="af-badge">{unread}</span>}
      </button>

      {open && (
        <div className="af-panel">
          <div className="af-panel-hd">
            <span className="af-panel-title">Scholar Activity</span>
            {unread > 0 && (
              <button className="af-mark-all" onClick={handleMarkAll}>
                Clear all
              </button>
            )}
            <button className="af-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {feed.length === 0 ? (
            <div className="af-empty">No new activity from scholars.</div>
          ) : (
            <div className="af-list">
              {feed.map(item => (
                <div key={item.id} className={`af-item ${TYPE_CLASSES[item.type] || ''}`}>
                  <div className="af-item-hd">
                    <span className="af-scholar">{item.scholar_key}</span>
                    <span className={`af-type-badge af-type-${item.type}`}>
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                    <span className="af-time">{timeAgo(item.created_at)}</span>
                    {item.type !== 'delete_request' && (
                      <button className="af-dismiss" title="Dismiss" onClick={() => onMarkRead([item.id])}>✕</button>
                    )}
                  </div>

                  {item.expense_data && (
                    <div className="af-item-body">
                      <span className="af-exp-name">{item.expense_data.item}</span>
                      <span className="af-exp-amt">
                        ₱{Math.round((item.expense_data.amount || 0) * (item.expense_data.qty || 1)).toLocaleString('en-US')}
                      </span>
                      {item.expense_data.sem && (
                        <span className="af-exp-sem">{item.expense_data.sem}</span>
                      )}
                    </div>
                  )}

                  {item.type === 'edited' && item.changes && (
                    <div className="af-changes">
                      {Object.entries(item.changes).map(([field, [from, to]]) =>
                        from !== to ? (
                          <div key={field} className="af-change-row">
                            <span className="af-change-field">{field}</span>
                            <span className="af-change-from">{String(from)}</span>
                            <span className="af-change-arrow">→</span>
                            <span className="af-change-to">{String(to)}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}

                  {item.type === 'delete_request' && (
                    <div className="af-del-actions">
                      <button className="af-approve-btn" onClick={() => onApprove(item)}>
                        Approve delete
                      </button>
                      <button className="af-deny-btn" onClick={() => onDeny(item)}>
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
