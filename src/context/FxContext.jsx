import React from 'react';
import { DEFAULT_RATE } from '../fx.js';

export const FxCtx = React.createContext(DEFAULT_RATE);

export function useFmt() {
  const rate = React.useContext(FxCtx);
  return (amount, currency) => {
    if (amount == null) return '—';
    if (currency === 'USD') return '$' + Math.round(amount / rate).toLocaleString('en-US');
    return '₱' + Math.round(amount).toLocaleString('en-US');
  };
}
