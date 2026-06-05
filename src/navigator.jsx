import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/navigator.css';
import { NGS_DATA } from '../scholars-data.js';
import { loadFromSheets } from './sheets-loader.js';
import { storedMode, storedRate, persistFx, fetchMarketRate } from './fx.js';
import { writeExpense, writeSemester } from './sheets-writer.js';
import { FxCtx } from './context/FxContext.jsx';
import { DataCtx } from './context/DataContext.jsx';
import { LockScreen } from './components/LockScreen.jsx';
import { NavBar } from './components/NavBar.jsx';
import { AlertsSection } from './components/AlertsSection.jsx';
import { StatusSection } from './components/StatusSection.jsx';
import { ExpenseSection } from './components/expenses/ExpenseSection.jsx';
import { DeadlinesSection } from './components/DeadlinesSection.jsx';
import { ActionsSection } from './components/ActionsSection.jsx';
import { EnglishSection } from './components/EnglishSection.jsx';
import { NavFooter } from './components/NavFooter.jsx';

if (!NGS_DATA || !NGS_DATA.config) {
  throw new Error('NGS_DATA missing — hard-refresh (Ctrl/Cmd+Shift+R)');
}

const STATIC_SCHOLAR_KEYS = ['claire', 'april', 'aljane'];

function Navigator() {
  // D is held in React state so Sheets updates trigger re-renders across all sections.
  const [D, setD] = useState(NGS_DATA);
  const scholarKeys = STATIC_SCHOLAR_KEYS.filter(k => D.scholars[k]);

  const [unlocked, setUnlocked] = useState(false);
  const [currency, setCurrency] = useState('PHP');
  const [alerts, setAlerts] = useState(() => (NGS_DATA.alerts || []).map(a => ({ ...a })));
  const [liveGpa, setLiveGpa] = useState({});
  const [sheetsStatus, setSheetsStatus] = useState('loading');
  const [refreshKey, setRefreshKey] = useState(0);

  const [fxMode, setFxMode] = useState(() => storedMode());
  const [fxRate, setFxRate] = useState(() => storedRate());
  const [fxStatus, setFxStatus] = useState('idle');

  const [writeError, setWriteError] = useState(false);

  useEffect(() => {
    if (!writeError) return;
    const t = setTimeout(() => setWriteError(false), 5000);
    return () => clearTimeout(t);
  }, [writeError]);

  // Persisted to localStorage so locally-added rows survive page refreshes.
  const [addedExpenses, setAddedExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_added') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    if (fxMode !== 'market') return;
    setFxStatus('loading');
    fetchMarketRate()
      .then(rate => {
        setFxRate(rate);
        setFxStatus('idle');
        persistFx('market', rate);
      })
      .catch(() => setFxStatus('error'));
  }, [fxMode]);

  function handleFxModeChange(mode) {
    setFxMode(mode);
    if (mode === 'manual') {
      setFxStatus('idle');
      persistFx('manual', fxRate);
    }
  }

  function handleFxRateChange(rate) {
    setFxRate(rate);
    persistFx('manual', rate);
  }

  useEffect(() => {
    setSheetsStatus('loading');
    loadFromSheets()
      .then(data => {
        const hasScholars = data.scholars && Object.keys(data.scholars).length > 0;
        if (!hasScholars) {
          console.warn('Sheets returned no scholar data — using static fallback');
          setSheetsStatus('static');
          return;
        }
        // Merge Sheets operational data with static narrative fields not held in Sheets.
        const mergedScholars = {};
        Object.keys(data.scholars).forEach(k => {
          mergedScholars[k] = {
            ...data.scholars[k],
            english: NGS_DATA.scholars[k]?.english,
            publicProfile: NGS_DATA.scholars[k]?.publicProfile,
          };
        });
        const merged = {
          ...data,
          scholars: mergedScholars,
          config: { ...data.config, password: data.config.password || NGS_DATA.config.password },
        };
        setD(merged);
        setAlerts((merged.alerts || []).map(a => ({ ...a })));
        setSheetsStatus('live');
      })
      .catch(err => {
        console.warn('Sheets unavailable, using static data:', err.message);
        setSheetsStatus('static');
      });
  }, [refreshKey]);

  function handleDismiss(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, _dismissed: true } : a));
  }

  function handleAddExpense(scholar, exp) {
    setAddedExpenses(prev => {
      const updated = { ...prev, [scholar]: [...(prev[scholar] || []), exp] };
      try { localStorage.setItem('ngs_added', JSON.stringify(updated)); } catch {}
      return updated;
    });
    writeExpense(scholar, exp).catch(() => setWriteError(true));
  }

  function handleSemesterChange(scholar, sem) {
    writeSemester(scholar, sem);
    setD(prev => ({
      ...prev,
      scholars: {
        ...prev.scholars,
        [scholar]: { ...prev.scholars[scholar], currentSem: sem },
      },
    }));
  }

  return (
    <DataCtx.Provider value={{ D, scholarKeys }}>
      <FxCtx.Provider value={fxRate}>
        <LockScreen isHiding={unlocked} onUnlock={() => setUnlocked(true)} />
        <NavBar
          currency={currency}
          onCurrencyChange={setCurrency}
          fxMode={fxMode}
          fxRate={fxRate}
          fxStatus={fxStatus}
          onFxModeChange={handleFxModeChange}
          onFxRateChange={handleFxRateChange}
          sheetsStatus={sheetsStatus}
          onRefresh={() => setRefreshKey(k => k + 1)}
        />
        <main className="wrap">
          <AlertsSection alerts={alerts} onDismiss={handleDismiss} />
          <StatusSection currency={currency} liveGpa={liveGpa} onSemesterChange={handleSemesterChange} />
          <ExpenseSection
            currency={currency}
            addedExpenses={addedExpenses}
            onAddExpense={handleAddExpense}
          />
          <DeadlinesSection />
          <ActionsSection />
          <EnglishSection />
        </main>
        <NavFooter sheetsStatus={sheetsStatus} writeError={writeError} />
      </FxCtx.Provider>
    </DataCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Navigator />);
