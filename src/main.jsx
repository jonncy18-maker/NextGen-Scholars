import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/site.css';
import { NGSSite } from './pages/HomePage.jsx';

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

  return <NGSSite isDesktop={isDesktop}/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
