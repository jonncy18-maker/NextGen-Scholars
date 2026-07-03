'use client';

import { Component } from 'react';

// Catches render-time crashes anywhere in the tree and shows the actual error
// on screen instead of unmounting React into a blank page. Without this, a
// single bad render (e.g. an unexpected data shape from Supabase) leaves the
// user staring at an empty page with no clue what failed.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', fontFamily: 'ui-monospace, Menlo, monospace', background: '#0E1A33', color: '#FAF7F0',
        }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ color: '#C9A84C', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Something went wrong
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: 'inherit', fontSize: 13, padding: '8px 16px', borderRadius: 5,
                border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.12)', color: '#C9A84C', cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
