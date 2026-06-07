import React, { useState, useEffect } from 'react';

export function NavBar({ currency, onCurrencyChange, fxMode, fxRate, fxStatus, onFxModeChange, onFxRateChange, sheetsStatus, onRefresh }) {
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
              min="1"
              max="999"
              step="0.01"
              onChange={handleRateInput}
              title={fxMode === 'market' ? 'Rate set by market — switch to Manual to edit' : 'PHP per 1 USD'}
            />
            {fxStatus === 'error' && <span className="fx-err" title="Could not fetch market rate">!</span>}
          </div>

          <button
            className={`nav-refresh${sheetsStatus === 'loading' ? ' is-loading' : ''}`}
            onClick={onRefresh}
            title="Reload data from Supabase"
          >
            <span className="refresh-icon">↻</span> Refresh
          </button>

          <span className="nav-badge">Mentor View</span>
          <a className="nav-back" href="index.html">← All scholars</a>
        </div>
      </div>
    </header>
  );
}
