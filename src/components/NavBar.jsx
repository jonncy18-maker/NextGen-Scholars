import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const MODULE_NAV = [
  { path: '/navigator',           label: 'Home' },
  { path: '/navigator/expenses',  label: 'Expenses' },
  { path: '/navigator/grades',    label: 'Grades' },
  { path: '/navigator/english',   label: 'English' },
  { path: '/navigator/deadlines', label: 'Deadlines' },
  { path: '/navigator/progress',  label: 'Progress' },
  { path: '/navigator/docs',      label: 'Docs' },
];

export function NavBar({
  currency, onCurrencyChange,
  fxMode, fxRate, fxStatus, onFxModeChange, onFxRateChange,
  sheetsStatus, onRefresh,
  fxPanelOpen, onFxPanelToggle,
  aiDrawerOpen, onAiDrawerToggle,
}) {
  const [inputVal, setInputVal] = useState(String(fxRate));
  const location = useLocation();

  useEffect(() => {
    setInputVal(fxRate.toFixed(2));
  }, [fxRate]);

  function handleRateInput(e) {
    setInputVal(e.target.value);
    const n = parseFloat(e.target.value);
    if (!isNaN(n) && n > 0) onFxRateChange(n);
  }

  function isActive(path) {
    if (path === '/navigator') return location.pathname === '/navigator' || location.pathname === '/navigator/';
    return location.pathname.startsWith(path);
  }

  return (
    <header className="nav">
      {/* Row 1 — brand + controls */}
      <div className="nav-inner">
        <Link className="nav-brand" to="/">
          <span className="ngs-mark ngs-mark-sm"><span>N</span><span>G</span><span>S</span></span>
          <span className="nav-name">Pathway Navigator</span>
        </Link>
        <div className="nav-right">
          <div className="nav-toggle">
            {['PHP', 'USD'].map(cur => (
              <button key={cur} className={currency === cur ? 'active' : ''} onClick={() => onCurrencyChange(cur)}>
                {cur === 'PHP' ? 'PHP ₱' : 'USD $'}
              </button>
            ))}
          </div>
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
          <Link className="nav-back" to="/">← All scholars</Link>
        </div>
      </div>

      {/* Row 2 — module route links */}
      <nav className="nav-sections-strip">
        <div className="nav-sections-inner">
          {MODULE_NAV.map(m => (
            <Link
              key={m.path}
              className={`nav-sec-link${isActive(m.path) ? ' is-active' : ''}`}
              to={m.path}
            >{m.label}</Link>
          ))}
        </div>
      </nav>

      {/* Row 3 — collapsible FX panel */}
      <div className={`nav-fx-row${fxPanelOpen ? ' is-open' : ''}`}>
        <div className="nav-fx-inner">
          <button className="nav-fx-toggle" onClick={onFxPanelToggle}>
            FX Conversion <span className="nav-fx-arrow">{fxPanelOpen ? '▾' : '▸'}</span>
          </button>
          {fxPanelOpen && (
            <div className="fx-widget">
              <span className="fx-label">$1 = ₱</span>
              <div className="fx-mode-toggle">
                <button
                  className={fxMode === 'market' ? 'active' : ''}
                  onClick={() => onFxModeChange('market')}
                  title="Fetch live market rate"
                >
                  {fxStatus === 'loading' ? '⟳' : 'Market'}
                </button>
                <button
                  className={fxMode === 'manual' ? 'active' : ''}
                  onClick={() => onFxModeChange('manual')}
                  title="Enter rate manually"
                >
                  Manual
                </button>
              </div>
              <input
                type="number"
                className={`fx-input${fxMode === 'market' ? ' is-market' : ''}`}
                value={inputVal}
                disabled={fxMode === 'market'}
                min="1" max="999" step="0.01"
                onChange={handleRateInput}
                title={fxMode === 'market' ? 'Rate set by market — switch to Manual to edit' : 'PHP per 1 USD'}
              />
              {fxStatus === 'error' && <span className="fx-err" title="Could not fetch market rate">!</span>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
