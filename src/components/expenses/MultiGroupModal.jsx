import React, { useState } from 'react';

const ALL_DIMS = [
  { id: 'year',     label: 'Year' },
  { id: 'semester', label: 'Semester' },
  { id: 'month',    label: 'Month' },
  { id: 'category', label: 'Category' },
];

export function MultiGroupModal({ currentDims, onConfirm, onCancel }) {
  const [grouped, setGrouped]     = useState([...currentDims]);
  const [ungrouped, setUngrouped] = useState(
    ALL_DIMS.filter(d => !currentDims.includes(d.id)).map(d => d.id)
  );
  const [dragItem, setDragItem]       = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  function getLabel(id) {
    return ALL_DIMS.find(d => d.id === id)?.label || id;
  }

  function handleDragStart(id, fromCol, fromIdx) {
    setDragItem({ id, fromCol, fromIdx });
  }

  function handleDragOver(e, col, idx) {
    e.preventDefault();
    setDragOverItem({ col, idx });
  }

  function handleDrop(e, col, targetIdx) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragItem) return;
    const { id, fromCol } = dragItem;
    let newUngrouped = [...ungrouped];
    let newGrouped   = [...grouped];
    if (fromCol === 'ungrouped') newUngrouped = newUngrouped.filter(d => d !== id);
    else newGrouped = newGrouped.filter(d => d !== id);
    if (col === 'ungrouped') newUngrouped.splice(targetIdx, 0, id);
    else newGrouped.splice(targetIdx, 0, id);
    setUngrouped(newUngrouped);
    setGrouped(newGrouped);
    setDragItem(null);
    setDragOverItem(null);
  }

  function handleDropOnCol(e, col) {
    e.preventDefault();
    if (!dragItem) return;
    const endIdx = col === 'ungrouped' ? ungrouped.length : grouped.length;
    handleDrop(e, col, endIdx);
  }

  function handleDragEnd() {
    setDragItem(null);
    setDragOverItem(null);
  }

  function handleConfirm() {
    onConfirm(grouped);
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel();
  }

  function renderItem(id, col, idx) {
    const isDragging  = dragItem?.id === id;
    const isDragOver  = dragOverItem?.col === col && dragOverItem?.idx === idx;
    const cls = [
      'mgroup-item',
      col === 'grouped' ? 'mgroup-item-active' : '',
      isDragging  ? 'is-dragging' : '',
      isDragOver  ? 'drag-over'   : '',
    ].filter(Boolean).join(' ');
    return (
      <div
        key={id}
        className={cls}
        draggable
        onDragStart={() => handleDragStart(id, col, idx)}
        onDragOver={e => handleDragOver(e, col, idx)}
        onDrop={e => handleDrop(e, col, idx)}
        onDragEnd={handleDragEnd}
      >
        {col === 'grouped' && (
          <span className="mgroup-level-badge">{idx + 1}</span>
        )}
        <span className="mgroup-drag-handle">⠿</span>
        {getLabel(id)}
      </div>
    );
  }

  return (
    <div className="mgroup-backdrop" onClick={handleBackdrop}>
      <div className="mgroup-modal">
        <div className="mgroup-header">
          <span className="mgroup-title">Multi-Level Grouping</span>
          <button className="mgroup-close" onClick={onCancel}>✕</button>
        </div>
        <p className="mgroup-desc">
          Drag dimensions into <strong>Grouped</strong>. Top = outermost level.
          Drag back to <strong>Ungrouped</strong> to remove.
        </p>
        <div className="mgroup-columns">
          <div
            className="mgroup-col"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDropOnCol(e, 'ungrouped')}
          >
            <div className="mgroup-col-hd">Ungrouped</div>
            <div className="mgroup-col-body">
              {ungrouped.length === 0
                ? <div className="mgroup-empty">All dimensions grouped</div>
                : ungrouped.map((id, idx) => renderItem(id, 'ungrouped', idx))
              }
            </div>
          </div>

          <div className="mgroup-arrow">⇄</div>

          <div
            className="mgroup-col mgroup-col-grouped"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDropOnCol(e, 'grouped')}
          >
            <div className="mgroup-col-hd">
              Grouped <span className="mgroup-col-hint">(top = outermost)</span>
            </div>
            <div className="mgroup-col-body">
              {grouped.length === 0
                ? <div className="mgroup-drop-hint">Drop dimensions here</div>
                : grouped.map((id, idx) => renderItem(id, 'grouped', idx))
              }
            </div>
          </div>
        </div>

        {grouped.length > 0 && (
          <div className="mgroup-preview">
            {grouped.map(id => getLabel(id)).join(' › ')}
          </div>
        )}

        <div className="mgroup-footer">
          <button className="mgroup-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="mgroup-confirm-btn" onClick={handleConfirm}>
            Apply{grouped.length > 0 ? ` (${grouped.length} level${grouped.length !== 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
