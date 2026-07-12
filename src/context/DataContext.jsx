import React from 'react';

// Holds the current NGS_DATA snapshot (static fallback or live Neon merge)
// plus the derived scholar key list. Navigator updates this when Neon loads.
export const DataCtx = React.createContext(null);

export function useData() {
  return React.useContext(DataCtx);
}
