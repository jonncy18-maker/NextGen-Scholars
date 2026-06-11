import React, { Component } from 'react';

export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`Section error [${this.props.name || 'unknown'}]:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          margin: '12px 0', padding: '16px 20px', borderRadius: 6,
          background: 'rgba(177,27,42,0.06)', border: '1px solid rgba(177,27,42,0.2)',
          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'var(--ngs-gold, #C9A84C)',
        }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>
            {this.props.name ? `${this.props.name} failed to render` : 'Section error'}
          </strong>
          <span style={{ color: 'var(--ngs-ink, #1C2233)', opacity: 0.7 }}>
            {String(this.state.error?.message || this.state.error)}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
