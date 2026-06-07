import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/navigator.css';
import { NGS_DATA } from '../scholars-data.js';
import { loadFromSupabase } from './supabase-loader.js';
import { storedMode, storedRate, persistFx, fetchMarketRate } from './fx.js';
import { writeExpense, writeSemester, updateExpense, deleteExpense, markActivityRead } from './supabase-writer.js';
import { supabase } from './lib/supabase.js';
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
import { ActivityFeed } from './components/ActivityFeed.jsx';

if (!NGS_DATA || !NGS_DATA.config) {
  throw new Error('NGS_DATA missing — hard-refresh (Ctrl/Cmd+Shift+R)');
}

const STATIC_SCHOLAR_KEYS = ['claire', 'april', 'aljane'];
const ALL_SECTION_IDS = ['alerts', 'status', 'expenses', 'deadlines', 'actions', 'english'];

function Navigator() {
  const [D, setD] = useState(NGS_DATA);
  const scholarKeys = STATIC_SCHOLAR_KEYS.filter(k => D.scholars[k]);

  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUnlocked(true);
    });
  }, []);

  const [currency, setCurrency] = useState('PHP');
  const [alerts, setAlerts]     = useState(() => (NGS_DATA.alerts || []).map(a => ({ ...a })));
  const [liveGpa, setLiveGpa]   = useState({});
  const [sheetsStatus, setSheetsStatus] = useState('loading');
  const [refreshKey, setRefreshKey]     = useState(0);

  const [fxMode, setFxMode]     = useState(() => storedMode());
  const [fxRate, setFxRate]     = useState(() => storedRate());
  const [fxStatus, setFxStatus] = useState('idle');

  const [writeError, setWriteError] = useState(false);

  // Activity feed — scholar-initiated changes from entry.html
  const [activityFeed, setActivityFeed] = useState([]);

  useEffect(() => {
    if (!writeError) return;
    const t = setTimeout(() => setWriteError(false), 5000);
    return () => clearTimeout(t);
  }, [writeError]);

  // Load unread activity on unlock + subscribe to realtime inserts.
  useEffect(() => {
    if (!unlocked) return;
    supabase
      .from('activity_log')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setActivityFeed(data || []));

    const channel = supabase
      .channel('ngs_activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, payload => {
        setActivityFeed(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [unlocked]);

  function removeExpenseFromD(scholarKey, expenseId) {
    setD(prev => {
      const sd = prev.scholars[scholarKey];
      if (!sd) return prev;
      const newExp = {};
      Object.entries(sd.expenses || {}).forEach(([sem, list]) => {
        newExp[sem] = list.filter(e => String(e.id) !== String(expenseId));
      });
      return { ...prev, scholars: { ...prev.scholars, [scholarKey]: { ...sd, expenses: newExp } } };
    });
  }

  function updateExpenseInD(scholarKey, expenseId, fields) {
    setD(prev => {
      const sd = prev.scholars[scholarKey];
      if (!sd) return prev;
      const newExp = {};
      Object.entries(sd.expenses || {}).forEach(([sem, list]) => {
        newExp[sem] = list.map(e => String(e.id) === String(expenseId) ? { ...e, ...fields } : e);
      });
      return { ...prev, scholars: { ...prev.scholars, [scholarKey]: { ...sd, expenses: newExp } } };
    });
  }

  async function handleApproveDelete(item) {
    try {
      await deleteExpense(item.expense_id);
      await markActivityRead([item.id]);
      setActivityFeed(prev => prev.filter(f => f.id !== item.id));
      removeExpenseFromD(item.scholar_key, item.expense_id);
    } catch (err) { console.error('approveDelete failed:', err); }
  }

  async function handleDenyDelete(item) {
    try {
      await markActivityRead([item.id]);
      setActivityFeed(prev => prev.filter(f => f.id !== item.id));
    } catch (err) { console.error('denyDelete failed:', err); }
  }

  async function handleMarkFeedRead(ids) {
    try {
      await markActivityRead(ids);
      setActivityFeed(prev => prev.filter(f => !ids.includes(f.id)));
    } catch (err) { console.error('markRead failed:', err); }
  }

  function handleEditExpense(scholarKey, expenseId, fields) {
    updateExpenseInD(scholarKey, expenseId, fields);
    updateExpense(expenseId, fields).catch(() => setWriteError(true));
  }

  // Persisted to localStorage so locally-added rows survive page refreshes.
  const [addedExpenses, setAddedExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_added') || '{}'); } catch { return {}; }
  });

  // Section collapse state (persisted)
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ngs_collapsed_sections') || '[]')); }
    catch { return new Set(); }
  });

  // FX panel open state (persisted, default collapsed)
  const [fxPanelOpen, setFxPanelOpen] = useState(() => {
    try { return localStorage.getItem('ngs_fx_panel') === 'true'; }
    catch { return false; }
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

  function handleFxPanelToggle() {
    setFxPanelOpen(v => {
      const next = !v;
      try { localStorage.setItem('ngs_fx_panel', String(next)); } catch {}
      return next;
    });
  }

  function toggleSection(sectionId) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      try { localStorage.setItem('ngs_collapsed_sections', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function expandAll() {
    setCollapsedSections(new Set());
    try { localStorage.setItem('ngs_collapsed_sections', '[]'); } catch {}
  }

  function collapseAll() {
    const all = new Set(ALL_SECTION_IDS);
    setCollapsedSections(all);
    try { localStorage.setItem('ngs_collapsed_sections', JSON.stringify(ALL_SECTION_IDS)); } catch {}
  }

  useEffect(() => {
    setSheetsStatus('loading');
    loadFromSupabase()
      .then(data => {
        const hasScholars = data.scholars && Object.keys(data.scholars).length > 0;
        if (!hasScholars) {
          console.warn('Sheets returned no scholar data — using static fallback');
          setSheetsStatus('static');
          return;
        }
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
          config: { ...data.config },
        };
        setD(merged);
        setAlerts((merged.alerts || []).map(a => ({ ...a })));
        setSheetsStatus('live');
      })
      .catch(err => {
        console.warn('Supabase unavailable, using static data:', err.message);
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

  const sec = (id) => ({
    id: `sec-${id}`,
    collapsed: collapsedSections.has(id),
    onToggle: () => toggleSection(id),
  });

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
          fxPanelOpen={fxPanelOpen}
          onFxPanelToggle={handleFxPanelToggle}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
        <main className="wrap">
          <AlertsSection alerts={alerts} onDismiss={handleDismiss} {...sec('alerts')} />
          <StatusSection currency={currency} liveGpa={liveGpa} onSemesterChange={handleSemesterChange} {...sec('status')} />
          <ExpenseSection
            currency={currency}
            addedExpenses={addedExpenses}
            onAddExpense={handleAddExpense}
            onEditExpense={handleEditExpense}
            {...sec('expenses')}
          />
          <DeadlinesSection {...sec('deadlines')} />
          <ActionsSection {...sec('actions')} />
          <EnglishSection {...sec('english')} />
        </main>
        <NavFooter sheetsStatus={sheetsStatus} writeError={writeError} />
        {unlocked && (
          <ActivityFeed
            feed={activityFeed}
            onApprove={handleApproveDelete}
            onDeny={handleDenyDelete}
            onMarkRead={handleMarkFeedRead}
          />
        )}
      </FxCtx.Provider>
    </DataCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Navigator />);
