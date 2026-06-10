import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/scholar-home.css';
import { ScholarHome } from '../pages/ScholarHome.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ScholarHome scholarKey="claire" />
);
