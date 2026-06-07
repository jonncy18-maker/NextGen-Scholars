import React, { useState, useEffect } from 'react';

const SECTION_NAV = [
  { id: 'sec-alerts',    label: '01  Alerts' },
  { id: 'sec-status',    label: '02  Status' },
  { id: 'sec-expenses',  label: '03  Expenses' },
  { id: 'sec-deadlines', label: '04  Deadlines' },
  { id: 'sec-english',   label: '05  English' },
];

export function NavBar({
  currency, onCurrencyChange,
  fxMode, fxRate, fxStatus, onFxModeChange, onFxRateChange,
  sheetsStatus, onRefresh,
  fxPanelOpen, onFxPanelToggle,
  onExpandAll, onCollapseAll,
}) {
  const [inputVal, setInputVal] = useState(String(fxRate));

  useEffect(() => {
    setInputVal(fxRate.toFixed(2));
  }, [fxRate]);

  function handleRateInput(e) {
    setInputVal(e.target.value);
    const n = parseFloat(e.target.value);
    if (!isNaN(n) && n > 0) onFxRateChange(n);
  }

  return (
    <header className="nav">
      {/* Row 1 — brand + controls */}
      <div className="nav-inner">
        <a className="nav-brand" href="index.html">
          <span className="ngs-mark ngs-mark-sm"><span>N</span><span>G</span><span>S</span></span>
          <span className="nav-name">Pathway Navigator</span>
        </a>
        <div className="nav-right">
          <div className="nav-toggle">
            {['PHP', 'USD'].map(cur => (
              <button key={cur} className={currency === cur ? 'active' : ''} onClick={() => onCurrencyChange(cur)}>
                {cur === 'PHP' ? 'PHP ₱' : 'USD $'}
              </button>
            ))}
          </div>
          <div className="nav-section-actions">
            <button className="nav-sect-btn" onClick={onExpandAll} title="Expand all sections">Expand all</button>
            <button className="nav-sect-btn" onClick={onCollapseAll} title="Collapse all sections">Collapse all</button>
          </div>
          <button
            className={`nav-refresh${sheetsStatus === 'loading' ? ' is-loading' : ''}`}
            onClick={onRefresh}
            title="Reload data from Supabase"
          >
            <span className="refresh-icon">↻</span> Refresh
          </button>
          <a className="nav-back" href="index.html">← All scholars</a>
        </div>
      </div>

      {/* Row 2 — section anchors */}
      <nav className="nav-sections-strip">
        <div className="nav-sections-inner">
          {SECTION_NAV.map(s => (
            <a key={s.id} className="nav-sec-link" href={`#${s.id}`}>{s.label}</a>
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
