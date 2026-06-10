import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/scholar-home.css';
import './styles/english-tracking.css';
import { EnglishTracking } from './pages/EnglishTracking.jsx';

const params = new URLSearchParams(location.search);
const scholarKey = params.get('scholar') || 'claire';

ReactDOM.createRoot(document.getElementById('root')).render(
  <EnglishTracking scholarKey={scholarKey} />
);
