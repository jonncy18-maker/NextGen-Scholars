import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/profile.css';
import { NGS_DATA } from '../scholars-data.js';
import { ScholarProfile } from './components/Profile/ScholarProfile.jsx';

const APRIL_DATA = NGS_DATA.scholars.april.publicProfile;

function App() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 960px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return <ScholarProfile data={APRIL_DATA} isMobile={!isDesktop}/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
