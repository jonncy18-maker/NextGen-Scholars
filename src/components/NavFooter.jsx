import React from 'react';
import { useData } from '../context/DataContext.jsx';

const CONN_LABEL = {
  loading: { text: 'Neon · syncing…', cls: 'conn-loading' },
  live:    { text: 'Neon · live',     cls: 'conn-live'    },
  static:  { text: 'Neon · offline',  cls: 'conn-static'  },
};

export function NavFooter({ connStatus, writeError }) {
  const { D } = useData();
  const pill = CONN_LABEL[connStatus] || CONN_LABEL.static;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-mark">
          <span className="ngs-mark on-navy"><span>N</span><span>G</span><span>S</span></span>
          <div className="footer-tag">One generation lifts another.</div>
        </div>
        <div className="footer-fine">
          <span>Pathway Navigator · Mentor View · Phase 1</span>
          <span className={`conn-pill ${pill.cls}`}>{pill.text}</span>
          {writeError && <span className="conn-pill conn-write-err">Write · failed</span>}
          <span>Last updated · {D.config.lastUpdated}</span>
        </div>
      </div>
    </footer>
  );
}
