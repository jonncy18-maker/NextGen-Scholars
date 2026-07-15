import React from 'react';

// Small dependency-free SVG viz primitives shared by MentorHome and
// ScholarHome. Colors come from CSS (shell.css) via class hooks, not props,
// so light/dark theming stays in one place.

// Circular progress ring with an optional icon/content slot in the middle.
// pct: 0–100 (null → indeterminate-looking empty track).
export function Ring({ pct, size = 64, stroke = 5, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = pct != null ? Math.max(0, Math.min(100, pct)) : 0;
  return (
    <span className="ds-ring" style={{ width: size, height: size, display: 'inline-flex', position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ds-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ds-ring-val"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(filled / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && (
        <span
          className="ds-ring-icon"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}

// Donut chart: segments = [{ label, value, color }]. Center shows
// centerVal/centerLbl. Zero-total renders an empty track only.
export function Donut({ segments, size = 120, stroke = 16, centerVal, centerLbl }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((t, s) => t + Math.max(0, s.value), 0);
  let offset = 0;
  return (
    <svg className="ds-donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle className="ds-donut-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
      {total > 0 &&
        segments.map((s, i) => {
          const frac = Math.max(0, s.value) / total;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${frac * c} ${c}`}
              strokeDashoffset={-offset * c}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += frac;
          return seg;
        })}
      {centerVal != null && (
        <text className="ds-donut-center-val" x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dy={centerLbl ? -4 : 0}>
          {centerVal}
        </text>
      )}
      {centerLbl && (
        <text className="ds-donut-center-lbl" x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dy={13}>
          {centerLbl}
        </text>
      )}
    </svg>
  );
}

// Tiny trend sparkline. values: numeric series (oldest → newest). Direction
// class (up/down/flat) is computed from first vs last so CSS colors it.
export function Sparkline({ values, width = 56, height = 18 }) {
  const pts = (values || []).filter((v) => v != null && !Number.isNaN(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (pts.length - 1);
  const coords = pts
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');
  const diff = pts[pts.length - 1] - pts[0];
  const dir = Math.abs(diff) < 0.05 ? 'flat' : diff > 0 ? 'up' : 'down';
  return (
    <svg className={`ds-spark is-${dir}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={coords} />
    </svg>
  );
}

// Journey mini-stepper (dots + connectors) used in glance rows and stat
// cards. total: step count; done: completed count; hasCurrent marks the
// next dot as in-progress.
export function MiniSteps({ total, done, hasCurrent = true }) {
  return (
    <span className="ds-steps">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={`ds-step-bar${i <= done - 1 ? ' is-done' : ''}`} />}
          <span
            className={`ds-step-dot${i < done ? ' is-done' : i === done && hasCurrent ? ' is-current' : ''}`}
          />
        </React.Fragment>
      ))}
    </span>
  );
}
