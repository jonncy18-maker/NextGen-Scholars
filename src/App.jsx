import React, { useState, useEffect } from 'react';
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

export default function App() {
  return (
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
  );
}
