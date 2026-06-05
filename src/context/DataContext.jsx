import React from 'react';

// Holds the current NGS_DATA snapshot (static fallback or live Sheets merge)
// plus the derived scholar key list. Navigator updates this when Sheets loads.
export const DataCtx = React.createContext(null);

export function useData() {
  return React.useContext(DataCtx);
}
