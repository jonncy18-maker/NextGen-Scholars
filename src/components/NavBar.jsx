import React from 'react';
import { Link } from 'react-router-dom';

export function NavBar({ sheetsStatus, onRefresh, aiDrawerOpen, onAiDrawerToggle }) {
  return (
    <header className="nav nav--slim">
      <div className="nav-inner">
        <Link className="nav-brand" to="/navigator">
          <span className="ngs-mark ngs-mark-sm"><span>N</span><span>G</span><span>S</span></span>
          <span className="nav-name">Pathway Navigator</span>
        </Link>
        <div className="nav-right">
          <button
            className={`nav-ai-btn${aiDrawerOpen ? ' is-active' : ''}`}
            onClick={onAiDrawerToggle}
            title="Open Navigator AI"
          >
            Ask AI
          </button>
          <button
            className={`nav-refresh${sheetsStatus === 'loading' ? ' is-loading' : ''}`}
            onClick={onRefresh}
            title="Reload data from Supabase"
          >
            <span className="refresh-icon">↻</span><span className="refresh-label"> Refresh</span>
          </button>
          <Link className="nav-back" to="/navigator">← Dashboard</Link>
        </div>
      </div>
    </header>
  );
}
