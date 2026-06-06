import React, { useState, useEffect, useRef } from 'react';
import { JOURNEY_STAGES } from '../constants.js';

export function JourneyDropdown({ baseHref = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const onMouse = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey  = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ngs-jdrop" ref={ref}>
      <div className="ngs-jdrop-trigger">
        <a href={`${baseHref}#journey`} className="ngs-jdrop-label">Journey</a>
        <button
          className={`ngs-jdrop-chevron${open ? ' is-open' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Journey sub-sections"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path
              d={open ? 'M1 8l4.5-4.5L10 8' : 'M1 3l4.5 4.5L10 3'}
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open && (
        <div className="ngs-jdrop-panel" role="menu">
          {JOURNEY_STAGES.map((s, i) => (
            <a
              key={i}
              href={`${baseHref}${s.href}`}
              className="ngs-jdrop-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="ngs-jdrop-num">0{i + 1}</span>
              <span>{s.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
