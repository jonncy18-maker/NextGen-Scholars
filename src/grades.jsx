import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/english-tracking.css';
import './styles/grade-entry.css';
import { GradeEntry } from './pages/GradeEntry.jsx';

const params = new URLSearchParams(location.search);
const scholarKey = params.get('scholar') || 'claire';

ReactDOM.createRoot(document.getElementById('root')).render(
  <GradeEntry scholarKey={scholarKey} />
);
