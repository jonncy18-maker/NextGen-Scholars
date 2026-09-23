import React from 'react';

// Small dependency-free SVG viz primitive shared by MentorHome and
// ScholarHome. Colors come from CSS (shell.css) via class hooks, not props,
// so light/dark theming stays in one place.

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
    .map(
      (v, i) =>
        `${(pad + i * step).toFixed(1)},${(height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(1)}`
    )
    .join(' ');
  const diff = pts[pts.length - 1] - pts[0];
  const dir = Math.abs(diff) < 0.05 ? 'flat' : diff > 0 ? 'up' : 'down';
  return (
    <svg
      className={`ds-spark is-${dir}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline points={coords} />
    </svg>
  );
}
