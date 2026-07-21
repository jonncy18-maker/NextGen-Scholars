import React from 'react';
import { NavigatorAIConsole } from './NavigatorAIConsole.jsx';

// Thin slide-over shell around the unified console. The old 4-tab strip
// (Ask / Log Expense / Log Grades / Weekly Report) is gone — the console's one
// textbox + deterministic router covers all of them. `writers` are the
// Navigator-level expense mutators the console needs for the edit/GCash paths.
export function NavigatorAIDrawer({ open, onClose, defaultScholar, writers }) {
  if (!open) return null;

  return (
    <>
      <div className="nai-drawer-overlay" onClick={onClose} />
      <div className="nai-drawer" role="dialog" aria-label="Navigator AI">
        <div className="nai-drawer-header">
          <span className="nai-drawer-title">
            Navigator <span className="nai-eyebrow-badge">AI</span>
          </span>
          <button className="nai-drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="nai-drawer-body nai-drawer-body--console">
          <NavigatorAIConsole defaultScholar={defaultScholar} writers={writers} onClose={onClose} />
        </div>
      </div>
    </>
  );
}
