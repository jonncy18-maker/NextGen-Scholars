import React, { useState, useEffect } from 'react';
import { useFmt } from '../../context/FxContext.jsx';
import { scholarTotals, allExpenses } from '../../utils.js';

const BUCKET_CARD_LABELS = {
  college:      'College',
  milestone:    'Milestones',
  life:         'Life',
  travel:       'Travel',
  exam:         'Exam',
  professional: 'Professional',
  admin:        'Admin',
};

export function TotalsRow({ s, currency }) {
  const $fmt = useFmt();
  const b = scholarTotals(s);
  const visibleBuckets = Object.entries(b.byBucket || {}).filter(([, v]) => v > 0);
  return (
    <div className="totals-row">
      <div className="total-card lead">
        <div className="total-val">{$fmt(b.total, currency)}</div>
        <div className="total-lbl">Total Invested</div>
      </div>
      {visibleBuckets.map(([key, val]) => (
        <div key={key} className="total-card">
          <div className="total-val">{$fmt(val, currency)}</div>
          <div className="total-lbl">{BUCKET_CARD_LABELS[key] || key}</div>
        </div>
      ))}
    </div>
  );
}

export function ChartSem({ s, currency, extraRows }) {
  const $fmt = useFmt();
  const sems = Object.keys(s.expenses || {});
  const extraSems = [...new Set((extraRows || []).map(r => r.sem))].filter(sem => !sems.includes(sem));
  const allSems = [...sems, ...extraSems];

  const data = allSems.map(sem => {
    let actual = 0, budget = 0;
    (s.expenses?.[sem] || []).forEach(e => { const tot = (e.amount || 0) * (e.qty || 1); if (e.avb === 'Actual') actual += tot; else budget += tot; });
    (extraRows || []).filter(r => r.sem === sem).forEach(e => { const tot = (e.amount || 0) * (e.qty || 1); if (e.avb === 'Actual') actual += tot; else budget += tot; });
    return { sem, actual, budget };
  });
  const max = Math.max(1, ...data.flatMap(d => [d.actual, d.budget]));
  const [ready, setReady] = useState(false);
  const [activeTip, setActiveTip] = useState(null);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  function toggleTip(key) {
    setActiveTip(prev => prev === key ? null : key);
  }

  return (
    <>
      <div className="bars">
        {data.map(d => (
          <div key={d.sem} className="bar-group">
            <div className="bar-pair">
              <div
                className="bar actual"
                style={{ height: ready ? Math.round(d.actual / max * 100) + '%' : '0%' }}
                onClick={() => toggleTip(d.sem + '-actual')}
              >
                <span className={`bar-tip${activeTip === d.sem + '-actual' ? ' is-visible' : ''}`}>{$fmt(d.actual, currency)}</span>
              </div>
              <div
                className="bar budget"
                style={{ height: ready ? Math.round(d.budget / max * 100) + '%' : '0%' }}
                onClick={() => toggleTip(d.sem + '-budget')}
              >
                <span className={`bar-tip${activeTip === d.sem + '-budget' ? ' is-visible' : ''}`}>{$fmt(d.budget, currency)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bar-xlabels">{data.map(d => <div key={d.sem} className="bar-xlabel">{d.sem}</div>)}</div>
      <div className="legend">
        <div className="legend-item"><span className="legend-swatch actual" />Actual spend</div>
        <div className="legend-item"><span className="legend-swatch budget" />Budgeted / projected</div>
      </div>
    </>
  );
}

export function ChartCat({ s, currency, extraRows }) {
  const $fmt = useFmt();
  const totals = {};
  [...allExpenses(s), ...(extraRows || [])].forEach(e => { totals[e.cat] = (totals[e.cat] || 0) + (e.amount || 0) * (e.qty || 1); });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  return (
    <div className="cat-rows">
      {entries.map(([cat, val]) => (
        <div key={cat} className="cat-row">
          <div className="cat-label">{cat}</div>
          <div className="cat-track">
            <div className="cat-fill" style={{ width: ready ? (val / max * 100) + '%' : '0%' }} />
          </div>
          <div className="cat-val">{$fmt(val, currency)}</div>
        </div>
      ))}
    </div>
  );
}
