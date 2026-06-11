import React, { useState, useEffect, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';

import './styles/site.css';
import './styles/profile.css';
import './styles/navigator.css';
import './styles/entry.css';
import './styles/scholar-home.css';
import './styles/english-tracking.css';
import './styles/grade-entry.css';

import { NGSSite } from './pages/HomePage.jsx';
import { ClairePage } from './entries/claire.jsx';
import { AprilPage } from './entries/april.jsx';
import { Navigator } from './entries/navigator.jsx';
import { EntryApp } from './entries/entry.jsx';
import { ScholarHome } from './pages/ScholarHome.jsx';
import { EnglishTracking } from './pages/EnglishTracking.jsx';
import { GradeEntry } from './pages/GradeEntry.jsx';

function HomeRoute() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 960px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return <NGSSite isDesktop={isDesktop} />;
}

function ScholarHomeRoute() {
  const { scholar } = useParams();
  return <ScholarHome scholarKey={scholar || 'claire'} />;
}

function EnglishRoute() {
  const { scholar } = useParams();
  return <EnglishTracking scholarKey={scholar || 'claire'} />;
}

function GradeRoute() {
  const { scholar } = useParams();
  return <GradeEntry scholarKey={scholar || 'claire'} />;
}

// Maps legacy MPA URLs (e.g. /navigator.html, /claire-home.html?scholar=claire)
// onto the SPA routes. Anything unrecognised falls back to the homepage so a
// stale bookmark or mistyped path can never render a blank screen.
const LEGACY_PATHS = {
  '/index.html': '/',
  '/claire.html': '/claire',
  '/april.html': '/april',
  '/navigator.html': '/navigator',
  '/entry.html': '/entry',
  '/claire-home.html': '/home/claire',
  '/april-home.html': '/home/april',
};

function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const lower = pathname.toLowerCase();

  if (LEGACY_PATHS[lower]) {
    return <Navigate to={`${LEGACY_PATHS[lower]}${search}${hash}`} replace />;
  }

  // english.html / grades.html carried the scholar in ?scholar=
  if (lower === '/english.html' || lower === '/grades.html') {
    const scholar = new URLSearchParams(search).get('scholar') || 'claire';
    const base = lower === '/english.html' ? '/english' : '/grades';
    return <Navigate to={`${base}/${scholar}${hash}`} replace />;
  }

  return <Navigate to="/" replace />;
}

// Catches render-time crashes anywhere in the tree and shows the actual error
// on screen instead of unmounting React into a blank page. Without this, a
// single bad render (e.g. an unexpected data shape from Supabase) leaves the
// user staring at an empty page with no clue what failed.
class ErrorBoundary extends Component {
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

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/NextGen-Scholars">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/claire" element={<ClairePage />} />
          <Route path="/april" element={<AprilPage />} />
          <Route path="/navigator" element={<Navigator />} />
          <Route path="/entry" element={<EntryApp />} />
          <Route path="/home/:scholar" element={<ScholarHomeRoute />} />
          <Route path="/english/:scholar" element={<EnglishRoute />} />
          <Route path="/grades/:scholar" element={<GradeRoute />} />
          <Route path="*" element={<LegacyRedirect />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
