import React from 'react';

export function BudgetSection() {
  return (
    <section className="section-card" style={{ margin: '32px auto', maxWidth: 900, padding: '48px 40px' }}>
      <div style={{ marginBottom: 8, fontFamily: 'var(--ngs-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ngs-muted)' }}>
        Module
      </div>
      <h2 style={{ fontFamily: 'var(--ngs-display)', fontSize: 32, fontWeight: 400, color: 'var(--ngs-navy)', letterSpacing: '-0.02em', marginBottom: 16 }}>
        Budgeting
      </h2>
      <p style={{ color: 'var(--ngs-muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 48 + 'ch' }}>
        Budget planning and forecasting tools are coming soon. This module will let you set semester budgets, project spending by category, and track allocation against actuals across scholars.
      </p>
    </section>
  );
}
