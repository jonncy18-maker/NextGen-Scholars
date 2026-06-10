import React from 'react';

const Icon = ({ children, size = 22, color = 'currentColor', strokeWidth = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconExpenses = (p) => <Icon {...p}>
  <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6V3z"/>
  <line x1="9" y1="8" x2="15" y2="8"/>
  <line x1="9" y1="11.5" x2="15" y2="11.5"/>
  <line x1="9" y1="15" x2="12.5" y2="15"/>
</Icon>;

export const IconGrades = (p) => <Icon {...p}>
  <line x1="3.5" y1="20.5" x2="20.5" y2="20.5"/>
  <rect x="5" y="13" width="3.4" height="7.5" rx="0.6"/>
  <rect x="10.3" y="9" width="3.4" height="11.5" rx="0.6"/>
  <rect x="15.6" y="4.5" width="3.4" height="16" rx="0.6"/>
</Icon>;

export const IconClock = (p) => <Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 7v5l3 2"/>
</Icon>;

export const IconIsland = (p) => <Icon {...p}>
  <path d="M3 19c3 1 6-1 9 0s6-1 9 0"/>
  <path d="M8 16l3-5 2 3 1-2 2 4"/>
  <path d="M16 16V8"/>
  <path d="M16 8c-1-2-3-2-4-1 1 0 3 0 4 1z"/>
  <path d="M16 8c1-2 3-2 4-1-1 0-3 0-4 1z"/>
</Icon>;

export const IconBriefcase = (p) => <Icon {...p}>
  <rect x="3" y="7.5" width="18" height="12.5" rx="2"/>
  <path d="M8.5 7.5V6a2 2 0 012-2h3a2 2 0 012 2v1.5"/>
  <line x1="3" y1="13" x2="21" y2="13"/>
  <path d="M11 13v1.5h2V13"/>
</Icon>;

export const IconTrophy = (p) => <Icon {...p}>
  <path d="M8 4h8v4a4 4 0 11-8 0V4z"/>
  <path d="M8 4H5v2a3 3 0 003 3"/>
  <path d="M16 4h3v2a3 3 0 01-3 3"/>
  <line x1="12" y1="12" x2="12" y2="16"/>
  <path d="M8 20h8l-1-4H9l-1 4z"/>
</Icon>;

export const IconMessage = (p) => <Icon {...p}>
  <path d="M4 5.5h16a1 1 0 011 1v9a1 1 0 01-1 1H9.5L5 21v-4H4a1 1 0 01-1-1v-9.5a1 1 0 011-1z"/>
  <line x1="8" y1="10" x2="16" y2="10"/>
  <line x1="8" y1="13" x2="13" y2="13"/>
</Icon>;

export const IconDocument = (p) => <Icon {...p}>
  <path d="M6 3h8l4 4v14H6z"/>
  <path d="M14 3v4h4"/>
  <line x1="9" y1="12.5" x2="15" y2="12.5"/>
  <line x1="9" y1="16" x2="15" y2="16"/>
</Icon>;

export const IconArrow = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" stroke={color} strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
