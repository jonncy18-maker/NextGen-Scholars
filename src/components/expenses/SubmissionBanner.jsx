import React, { useState } from 'react';
import { NAMECLASS } from '../../constants.js';

const FEED_TYPE_LABELS = {
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

function SubmissionItem({ sub, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const exp = sub.expense_data || {};
  const total = (exp.amount || 0) * (exp.qty || 1);

  return (
    <div className="activity-item activity-item-submission">
      <div className="activity-item-hd">
        <span className={`scholar-tag ${NAMECLASS[sub.scholar_key] || ''}`}>{sub.scholar_key}</span>
        <span className="activity-type-badge activity-type-new">New expense</span>
        <span className="activity-time">{timeAgo(sub.created_at)}</span>
      </div>
      <div className="activity-item-body">
        <span className="activity-exp-name">{exp.item}</span>
        <span className="activity-exp-amt">₱{Math.round(total).toLocaleString('en-US')}</span>
        {exp.sem   && <span className="activity-exp-sem">{exp.sem}</span>}
        {exp.cat   && <span className="activity-exp-cat">{exp.cat}</span>}
        {exp.date  && <span className="activity-exp-cat">{exp.date}</span>}
        {exp.qty > 1 && <span className="activity-exp-cat">×{exp.qty}</span>}
        {exp.vendor && <span className="activity-exp-cat">{exp.vendor}</span>}
      </div>
      {!rejecting ? (
        <div className="activity-sub-actions">
          <button className="sub-approve-btn" onClick={() => onApprove(sub)}>✓ Approve</button>
          <button className="sub-reject-btn" onClick={() => { setRejecting(true); setComment(''); }}>✕ Reject</button>
        </div>
      ) : (
        <div className="activity-reject-form">
          <textarea
            className="activity-reject-comment"
            placeholder="Reason for rejection (optional)…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            autoFocus
          />
          <div className="activity-reject-actions">
            <button className="sub-reject-confirm-btn" onClick={() => { onReject(sub, comment); setRejecting(false); }}>
              Send rejection
            </button>
            <button className="sub-reject-cancel-btn" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedItem({ item, onMarkRead, onApprove, onDeny }) {
  return (
    <div className={`activity-item af-type-${item.type}`}>
      <div className="activity-item-hd">
        <span className={`scholar-tag ${NAMECLASS[item.scholar_key] || ''}`}>{item.scholar_key}</span>
        <span className={`activity-type-badge activity-type-${item.type}`}>
          {FEED_TYPE_LABELS[item.type] || item.type}
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

export function SubmissionBanner({
  submissions, feed, dbAlerts,
  onApprove, onReject, onApproveDelete, onDenyDelete, onMarkRead, onDismissAlert,
}) {
  const [open, setOpen] = useState(false);

  const subCount  = submissions?.length  || 0;
  const feedCount = feed?.length         || 0;
  const sysCount  = dbAlerts?.length     || 0;
  const total     = subCount + feedCount + sysCount;
  const hasPending = total > 0;

  return (
    <>
      <div
        className={`sub-banner${hasPending ? ' sub-banner--alert' : ' sub-banner--ok'}`}
        role={hasPending ? 'button' : undefined}
        tabIndex={hasPending ? 0 : undefined}
        onClick={hasPending ? () => setOpen(true) : undefined}
        onKeyDown={hasPending ? e => e.key === 'Enter' && setOpen(true) : undefined}
      >
        {hasPending
          ? <>
              <span className="sub-banner-dot" />
              {total} scholar update{total !== 1 ? 's' : ''} pending review — click to review
            </>
          : <>
              <span className="sub-banner-check">✓</span>
              No pending scholar updates
            </>
        }
      </div>

      {open && (
        <div className="sub-modal-overlay" onClick={() => setOpen(false)}>
          <div className="sub-modal" onClick={e => e.stopPropagation()}>
            <div className="sub-modal-hd">
              <span className="sub-modal-title">Scholar Updates</span>
              <span className="sub-modal-count">{total} pending</span>
              <button className="sub-modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="sub-modal-body">
              {sysCount > 0 && (
                <div className="sys-alerts-block">
                  {(dbAlerts || []).map(a => (
                    <div key={a.id} className={`sys-alert sys-alert-${a.severity}`}>
                      <div className="sys-alert-body">
                        <span className={`sys-alert-pill sys-alert-pill-${a.severity}`}>
                          {a.severity === 'critical' ? '⚠ Critical' : '⚠ Warning'}
                        </span>
                        <span className="sys-alert-title">{a.title}</span>
                        {a.sub && <span className="sys-alert-sub">{a.sub}</span>}
                      </div>
                      <button className="alert-x" aria-label="Dismiss" onClick={() => onDismissAlert(a.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="activity-list">
                {total === 0 && (
                  <div className="alert-empty">
                    <span className="check">✓</span>No pending updates from scholars.
                  </div>
                )}
                {(submissions || []).map(sub => (
                  <SubmissionItem
                    key={sub.id}
                    sub={sub}
                    onApprove={s => { onApprove(s); if (subCount + feedCount + sysCount - 1 === 0) setOpen(false); }}
                    onReject={onReject}
                  />
                ))}
                {(feed || []).map(item => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    onMarkRead={onMarkRead}
                    onApprove={onApproveDelete}
                    onDeny={onDenyDelete}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
