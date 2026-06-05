import React, { useState, useEffect } from 'react';
import { storedMode, storedRate, persistFx, fetchMarketRate, DEFAULT_RATE } from '../fx.js';

export const FxCtx = React.createContext(DEFAULT_RATE);

export function useFmt() {
  const rate = React.useContext(FxCtx);
  return (amount, currency) => {
    if (amount == null) return '—';
    if (currency === 'USD') return '$' + Math.round(amount / rate).toLocaleString('en-US');
    return '₱' + Math.round(amount).toLocaleString('en-US');
  };
}

export function useFxState() {
  const [fxMode, setFxMode] = useState(() => storedMode());
  const [fxRate, setFxRate] = useState(() => storedRate());
  const [fxStatus, setFxStatus] = useState('idle');
  const [currency, setCurrency] = useState('PHP');

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

  function handleModeChange(mode) {
    setFxMode(mode);
    if (mode === 'manual') { setFxStatus('idle'); persistFx('manual', fxRate); }
  }
  function handleRateChange(rate) { setFxRate(rate); persistFx('manual', rate); }

  return { currency, setCurrency, fxMode, fxRate, fxStatus, handleModeChange, handleRateChange };
}
