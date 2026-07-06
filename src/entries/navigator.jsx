import React, { useState, useEffect } from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { loadFromSupabase, loadPendingSubmissions } from '../api-loader.js';
import { writeExpense, writeSemester, updateExpense, deleteExpense, markActivityRead, approveSubmission, rejectSubmission, writeSent } from '../api-writer.js';
import { authClient, invalidateToken } from '../lib/auth-client.js';
import { api } from '../lib/api.js';
import { useChanges } from '../hooks/useChanges.js';
import { CAT_TO_BUCKET } from '../constants.js';
import { FxCtx, useFxState } from '../context/FxContext.jsx';
import { DataCtx } from '../context/DataContext.jsx';
import { LockScreen } from '../components/LockScreen.jsx';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary.jsx';
import { NavBar } from '../components/NavBar.jsx';
import { SubmissionBanner } from '../components/expenses/SubmissionBanner.jsx';
import { StatusSection } from '../components/StatusSection.jsx';
import { ExpenseSection } from '../components/expenses/ExpenseSection.jsx';
import { DeadlinesSection } from '../components/DeadlinesSection.jsx';
import { EnglishSection } from '../components/EnglishSection.jsx';
import { NavigatorAI } from '../components/NavigatorAI.jsx';
import { ExpenseWorkbench } from '../components/expenses/ExpenseWorkbench.jsx';
import { NavigatorAIDrawer } from '../components/NavigatorAIDrawer.jsx';
import { MentorHome } from '../components/MentorHome.jsx';
import { CareerSection } from '../components/CareerSection.jsx';
import { RiskSection } from '../components/RiskSection.jsx';
import { GradesSection } from '../components/GradesSection.jsx';
import { NavFooter } from '../components/NavFooter.jsx';
import { BudgetSection } from '../components/BudgetSection.jsx';
import { TravelModule } from '../components/TravelModule.jsx';
import { MilestonesModule } from '../components/MilestonesModule.jsx';
import { ProgramDetailsSection } from '../components/ProgramDetailsSection.jsx';

if (!NGS_DATA || !NGS_DATA.config) {
  throw new Error('NGS_DATA missing — hard-refresh (Ctrl/Cmd+Shift+R)');
}

const STATIC_SCHOLAR_KEYS = ['claire', 'april', 'janndilyne'];

// Derive the spend bucket for an expense the same way supabase-loader does, so
// realtime INSERT/UPDATE rows get bucketed correctly (not silently → 'college').
function bucketFor(cat, fallback) {
  const raw = CAT_TO_BUCKET[cat] ?? fallback ?? 'college';
  return raw === 'trial' ? 'college' : raw;
}

// Compute per-scholar GPA (as %) from the most recent sem in grade_entries,
// plus the sem before it (prev) so the dashboard can show a trend arrow.
function computeLiveGpa(rows) {
  const byScholar = {};
  rows.forEach(r => { (byScholar[r.scholar] ??= []).push(r); });
  const result = {};
  const prevResult = {};
  Object.entries(byScholar).forEach(([sk, list]) => {
    const sems = [...new Set(list.map(r => r.sem))].sort((a, b) => b.localeCompare(a));
    const found = [];
    for (const sem of sems) {
      const semRows = list.filter(r => r.sem === sem && r.pct_equiv != null && r.units);
      if (!semRows.length) continue;
      const totalUnits = semRows.reduce((s, r) => s + r.units, 0);
      if (totalUnits) found.push(semRows.reduce((s, r) => s + r.pct_equiv * r.units, 0) / totalUnits);
      if (found.length === 2) break;
    }
    if (found.length > 0) result[sk] = found[0];
    if (found.length > 1) prevResult[sk] = found[1];
  });
  return { result, prevResult };
}

export function Navigator({ slug = [] }) {
  const section = slug[0] || '';
  const [D, setD] = useState(NGS_DATA);
  const scholarKeys = STATIC_SCHOLAR_KEYS.filter(k => D.scholars[k]);

  const [unlocked, setUnlocked] = useState(false);
  // Every Navigator section is its own Next.js page (app/navigator/[[...slug]]),
  // so this component remounts fresh on each section navigation, and the
  // session check below is async — without this, LockScreen would flash
  // fully opaque on every nav click before the check resolves. Mirrors
  // ScholarAuthGate's checkingSession guard.
  const [authChecked, setAuthChecked] = useState(false);

  // Check the persisted Neon Auth (Better Auth) session — not Supabase's,
  // which is only a best-effort side session for the not-yet-ported
  // Drive/ask Edge Functions (see LockScreen.jsx) and can't be relied on to
  // reflect real sign-in state. A session alone isn't enough: the same
  // browser may have a leftover scholar session (e.g. from testing
  // /home/claire) — verify via /api/me that it's actually the mentor before
  // skipping LockScreen, otherwise Navigator silently renders scoped to
  // whichever scholar signed in last.
  useEffect(() => {
    authClient.getSession().then(async ({ data }) => {
      if (!data?.session) { setAuthChecked(true); return; }
      try {
        const me = await api.get('/me');
        if (me.role === 'mentor') setUnlocked(true);
      } catch {
        // not a mentor session — leave locked, LockScreen will prompt
      } finally {
        setAuthChecked(true);
      }
    }).catch(() => setAuthChecked(true));
  }, []);

  // Reactive FX rate (auto-refreshes in market mode), shared with profile pages
  // via localStorage. Replaces a one-time storedRate() read that never updated.
  const { fxRate, fxStatus, currency, setCurrency, handleModeChange } = useFxState();

  function handleExpCurrencyChange(c) {
    setCurrency(c);
    if (c === 'USD') handleModeChange('market');
  }
  const [liveGpa, setLiveGpa]   = useState({});
  const [prevGpa, setPrevGpa]   = useState({});
  const [sheetsStatus, setSheetsStatus] = useState('loading');
  const [refreshKey, setRefreshKey]     = useState(0);

  const [writeError, setWriteError] = useState(false);

  // Activity feed — edits/delete requests from entry.html
  const [activityFeed, setActivityFeed] = useState([]);
  // Pending expense submissions awaiting approval
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  // System alerts from DB (auto-generated by triggers, e.g. GPA risk)
  const [dbAlerts, setDbAlerts] = useState([]);

  useEffect(() => {
    if (!writeError) return;
    const t = setTimeout(() => setWriteError(false), 5000);
    return () => clearTimeout(t);
  }, [writeError]);

  // Load activity + pending submissions on unlock; useChanges (below) keeps
  // them fresh afterwards via polling — replaces the 5 Supabase realtime
  // channels that used to live in this effect (Phase B3).
  function loadUnreadActivity() {
    api.get('/activity?unread=1')
      .then(data => setActivityFeed(data || []))
      .catch(() => setActivityFeed([]));
  }

  // bootstrap doesn't sort by severity like the old .order('severity') did,
  // so sort client-side to match.
  function sortBySeverity(rows) {
    return [...(rows || [])].sort((a, b) => (a.severity || '').localeCompare(b.severity || ''));
  }

  function loadAlerts() {
    api.get('/bootstrap?tables=alerts')
      .then(({ alerts }) => setDbAlerts(sortBySeverity(alerts)))
      .catch(() => setDbAlerts([]));
  }

  function loadLiveGpa() {
    api.get('/grades')
      .then(data => {
        if (!data) return;
        const { result, prevResult } = computeLiveGpa(data);
        setLiveGpa(result);
        setPrevGpa(prevResult);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!unlocked) return;
    loadUnreadActivity();
    loadPendingSubmissions()
      .then(setPendingSubmissions)
      .catch(err => console.warn('loadPendingSubmissions failed:', err.message));
    loadAlerts();
    loadLiveGpa();
  }, [unlocked]);

  // Polling (replaces realtime): alerts/activity/submissions/grades are small
  // tables, cheapest to just refetch in full on any change. Expenses gets a
  // targeted patch (same upsert/delete-by-id shape the old INSERT/UPDATE
  // realtime handlers used) since D.scholars[*].expenses is a large nested
  // structure not worth refetching whole on every poll tick.
  useChanges(deltas => {
    if (!unlocked) return;

    if (deltas.alerts?.rows.length || deltas.alerts?.deletedIds.length) loadAlerts();
    if (deltas.activity_log?.rows.length) loadUnreadActivity();
    if (deltas.expense_submissions?.rows.length) {
      loadPendingSubmissions().then(setPendingSubmissions).catch(() => {});
    }
    if (deltas.grade_entries?.rows.length || deltas.grade_entries?.deletedIds.length) loadLiveGpa();

    const expDelta = deltas.expenses;
    if (expDelta && (expDelta.rows.length || expDelta.deletedIds.length)) {
      setD(prev => {
        let scholars = prev.scholars;
        expDelta.rows.forEach(e => {
          if (!e?.scholar || !e?.sem) return;
          const sd = scholars[e.scholar];
          if (!sd) return;
          const row = { id: e.id, item: e.item, amount: parseFloat(e.amount) || 0, qty: parseFloat(e.qty) || 1, cat: e.cat, bucket: bucketFor(e.cat, e.bucket), date: e.date, sent: e.sent, avb: e.avb, vendor: e.vendor || '', sem: e.sem, group_id: e.group_id || null };
          const semList = sd.expenses?.[e.sem] || [];
          const exists = semList.some(ex => String(ex.id) === String(e.id));
          const newSemList = exists
            ? semList.map(ex => String(ex.id) === String(e.id) ? row : ex)
            : [...semList, row];
          scholars = { ...scholars, [e.scholar]: { ...sd, expenses: { ...(sd.expenses || {}), [e.sem]: newSemList } } };
        });
        if (expDelta.deletedIds.length) {
          const deleted = new Set(expDelta.deletedIds.map(String));
          Object.entries(scholars).forEach(([key, sd]) => {
            const newExp = {};
            let changed = false;
            Object.entries(sd.expenses || {}).forEach(([sem, list]) => {
              const filtered = list.filter(ex => !deleted.has(String(ex.id)));
              if (filtered.length !== list.length) changed = true;
              newExp[sem] = filtered;
            });
            if (changed) scholars = { ...scholars, [key]: { ...sd, expenses: newExp } };
          });
        }
        return scholars === prev.scholars ? prev : { ...prev, scholars };
      });
    }
  });

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

  function addExpenseToD(scholarKey, expense) {
    const sem = expense.sem;
    setD(prev => {
      const sd = prev.scholars[scholarKey];
      if (!sd || !sem) return prev;
      const semList = sd.expenses?.[sem] || [];
      if (semList.some(e => String(e.id) === String(expense.id))) return prev;
      const newExp = { ...(sd.expenses || {}), [sem]: [...semList, expense] };
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

  async function handleApproveSubmission(sub) {
    try {
      await approveSubmission(sub.id, sub.expense_data, sub.scholar_key);
      setPendingSubmissions(prev => prev.filter(s => s.id !== sub.id));
      if (sub.expense_data) {
        addExpenseToD(sub.scholar_key, { ...sub.expense_data, status: sub.expense_data.avb });
      }
    } catch (err) { console.error('approveSubmission failed:', err); setWriteError(true); }
  }

  async function handleRejectSubmission(sub, comment) {
    try {
      await rejectSubmission(sub.id, comment);
      setPendingSubmissions(prev => prev.filter(s => s.id !== sub.id));
    } catch (err) { console.error('rejectSubmission failed:', err); setWriteError(true); }
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

  async function handleDismissDbAlert(alertId) {
    try {
      await api.del(`/alerts/${alertId}`);
      setDbAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) { console.error('dismissAlert failed:', err); }
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

  function handleDeleteExpenseFromTable(scholarKey, expenseId) {
    removeExpenseFromD(scholarKey, expenseId);
    setAddedExpenses(prev => ({
      ...prev,
      [scholarKey]: (prev[scholarKey] || []).filter(e => String(e.id) !== String(expenseId)),
    }));
    deleteExpense(expenseId).catch(err => { console.error('deleteExpense failed:', err); setWriteError(true); });
  }

  const [addedExpenses, setAddedExpenses] = useLocalStorage('ngs_added', {});

  const [aiDrawerOpen, setAiDrawerOpen]           = useState(false);
  const [aiDrawerTab, setAiDrawerTab]             = useState('query');
  const [aiDrawerDefaultScholar, setAiDefaultScholar] = useState(null);

  function openDrawer(tab = 'query', scholarKey = null) {
    setAiDrawerTab(tab);
    setAiDefaultScholar(scholarKey);
    setAiDrawerOpen(true);
  }

  useEffect(() => {
    if (!unlocked) return;
    setSheetsStatus('loading');
    loadFromSupabase()
      .then(data => {
        // The browser's Better Auth session is shared across tabs/origins —
        // if another tab signed in as a scholar after this one unlocked as
        // mentor, this fetch would silently come back scoped to that
        // scholar. Re-lock rather than rendering a scoped-down dashboard.
        if (data.role !== 'mentor') {
          console.warn(`/api/bootstrap returned role="${data.role}", not mentor — re-locking`);
          setUnlocked(false);
          return;
        }
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
        setSheetsStatus('live');
      })
      .catch(err => {
        console.warn('Supabase unavailable, using static data:', err.message);
        setSheetsStatus('static');
      });
  }, [refreshKey, unlocked]);

  function handleAddExpense(scholar, exp) {
    addExpenseToD(scholar, { ...exp, status: exp.avb });
    setAddedExpenses(prev => ({ ...prev, [scholar]: [...(prev[scholar] || []), exp] }));
    writeExpense(scholar, exp).catch(() => setWriteError(true));
  }

  // Record a GCash send: insert the transfer fee as a (sent) expense, then mark
  // every item included in the send as sent. Used by the GCash calculator's
  // "Record send" button and its AI box. Returns a summary for the caller's toast.
  function handleRecordSend(scholar, { itemIds = [], fee = 0, sem, feeLabel } = {}) {
    const today = new Date().toISOString().split('T')[0];
    let feeExp = null;
    if (fee > 0) {
      feeExp = {
        id:     `local_${Date.now()}_gcfee`,
        item:   feeLabel || 'GCash fee (transfer)',
        cat:    'Other',
        bucket: CAT_TO_BUCKET['Other'] || 'college',
        amount: fee,
        qty:    1,
        date:   today,
        avb:    'Actual',
        sent:   'Yes',
        sem:    sem || D.scholars[scholar]?.currentSem || '',
      };
      addExpenseToD(scholar, { ...feeExp, status: 'Actual' });
      setAddedExpenses(prev => ({ ...prev, [scholar]: [...(prev[scholar] || []), feeExp] }));
      writeExpense(scholar, feeExp).catch(() => setWriteError(true));
    }
    itemIds.forEach(id => {
      updateExpenseInD(scholar, id, { sent: 'Yes' });
      writeSent(id, scholar).catch(() => setWriteError(true));
    });
    return { feeRecorded: !!feeExp, fee, count: itemIds.length };
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
      <div className="nav-app">
        <LockScreen isHiding={unlocked || !authChecked} onUnlock={() => setUnlocked(true)} />
        <NavBar
          sheetsStatus={sheetsStatus}
          onRefresh={() => setRefreshKey(k => k + 1)}
          aiDrawerOpen={aiDrawerOpen}
          onAiDrawerToggle={() => setAiDrawerOpen(v => !v)}
          onSignOut={() => { invalidateToken(); authClient.signOut(); setUnlocked(false); }}
        />
        <NavigatorAIDrawer
          open={aiDrawerOpen}
          onClose={() => setAiDrawerOpen(false)}
          tab={aiDrawerTab}
          onTabChange={setAiDrawerTab}
          defaultScholar={aiDrawerDefaultScholar}
        />
        <main className="wrap">
          {section === '' && (
            <SectionErrorBoundary name="MentorHome">
              <MentorHome
                liveGpa={liveGpa}
                prevGpa={prevGpa}
                onOpenDrawer={openDrawer}
                pendingSubmissions={pendingSubmissions}
                activityCount={activityFeed.length}
                dbAlerts={dbAlerts}
                onSemesterChange={handleSemesterChange}
              />
            </SectionErrorBoundary>
          )}
          {section === 'expenses' && (
            <>
              <SubmissionBanner
                submissions={pendingSubmissions}
                feed={activityFeed}
                dbAlerts={dbAlerts}
                onApprove={handleApproveSubmission}
                onReject={handleRejectSubmission}
                onApproveDelete={handleApproveDelete}
                onDenyDelete={handleDenyDelete}
                onMarkRead={handleMarkFeedRead}
                onDismissAlert={handleDismissDbAlert}
              />
              <SectionErrorBoundary name="Expenses">
                <ExpenseSection
                  currency={currency}
                  onCurrencyChange={handleExpCurrencyChange}
                  fxRate={fxRate}
                  fxStatus={fxStatus}
                  addedExpenses={addedExpenses}
                  onAddExpense={handleAddExpense}
                  onEditExpense={handleEditExpense}
                  onDeleteExpense={handleDeleteExpenseFromTable}
                  id="sec-expenses" collapsed={false} onToggle={() => {}}
                  workbenchSlot={scholar => (
                    <ExpenseWorkbench
                      scholar={scholar}
                      onAddExpense={handleAddExpense}
                      onRecordSend={handleRecordSend}
                    />
                  )}
                />
              </SectionErrorBoundary>
            </>
          )}
          {section === 'grades' && (
            <SectionErrorBoundary name="Grades">
              <GradesSection id="sec-grades" collapsed={false} onToggle={() => {}} />
            </SectionErrorBoundary>
          )}
          {section === 'english' && (
            <>
              <SectionErrorBoundary name="English">
                <EnglishSection id="sec-english" collapsed={false} onToggle={() => {}} />
              </SectionErrorBoundary>
              <SectionErrorBoundary name="Navigator AI">
                <NavigatorAI id="sec-navigator-ai" collapsed={false} onToggle={() => {}} englishOnly={true} />
              </SectionErrorBoundary>
            </>
          )}
          {section === 'deadlines' && (
            <SectionErrorBoundary name="Deadlines">
              <DeadlinesSection id="sec-deadlines" collapsed={false} onToggle={() => {}} />
            </SectionErrorBoundary>
          )}
          {section === 'progress' && (
            <>
              <SectionErrorBoundary name="Career">
                <CareerSection id="sec-career" collapsed={false} onToggle={() => {}} />
              </SectionErrorBoundary>
              <SectionErrorBoundary name="Risk">
                <RiskSection id="sec-risk" collapsed={false} onToggle={() => {}} />
              </SectionErrorBoundary>
            </>
          )}
          {section === 'budget' && (
            <SectionErrorBoundary name="Budget">
              <BudgetSection />
            </SectionErrorBoundary>
          )}
          {section === 'program-details' && (
            <SectionErrorBoundary name="Program Details">
              <ProgramDetailsSection id="sec-program-details" collapsed={false} onToggle={() => {}} />
            </SectionErrorBoundary>
          )}
          {section === 'travel' && (
            <SectionErrorBoundary name="Travel">
              <TravelModule id="sec-travel" />
            </SectionErrorBoundary>
          )}
          {section === 'milestones' && (
            <SectionErrorBoundary name="Milestones">
              <MilestonesModule id="sec-milestones" />
            </SectionErrorBoundary>
          )}
        </main>
        {unlocked && !aiDrawerOpen && (
          <button
            className="nav-ai-fab"
            onClick={() => openDrawer('query')}
            title="Ask the Navigator AI"
          >
            <span className="nav-ai-fab-dot" />
            Ask AI
          </button>
        )}
        <NavFooter sheetsStatus={sheetsStatus} writeError={writeError} />
      </div>
      </FxCtx.Provider>
    </DataCtx.Provider>
  );
}

