import React from 'react';
import { useData } from '../context/DataContext.jsx';

const SHEETS_LABEL = {
  loading: { text: 'Neon · syncing…', cls: 'sheets-loading' },
  live:    { text: 'Neon · live',     cls: 'sheets-live'    },
  static:  { text: 'Neon · offline',  cls: 'sheets-static'  },
};

export function NavFooter({ sheetsStatus, writeError }) {
  const { D } = useData();
  const pill = SHEETS_LABEL[sheetsStatus] || SHEETS_LABEL.static;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-mark">
          <span className="ngs-mark on-navy"><span>N</span><span>G</span><span>S</span></span>
          <div className="footer-tag">One generation lifts another.</div>
        </div>
        <div className="footer-fine">
          <span>Pathway Navigator · Mentor View · Phase 1</span>
          <span className={`sheets-pill ${pill.cls}`}>{pill.text}</span>
          {writeError && <span className="sheets-pill sheets-write-err">Write · failed</span>}
          <span>Last updated · {D.config.lastUpdated}</span>
        </div>
      </div>
    </footer>
  );
}
