import React from 'react';

const Icon = ({ children, size = 22, color = 'currentColor', fill = 'none', strokeWidth = 1.6, viewBox = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill}
       stroke={color} strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconPhone = (p) => <Icon {...p}>
  <rect x="7" y="3" width="10" height="18" rx="2"/>
  <line x1="11" y1="18" x2="13" y2="18"/>
</Icon>;

export const IconLaptop = (p) => <Icon {...p}>
  <rect x="4" y="5" width="16" height="11" rx="1.5"/>
  <path d="M2 19h20l-1.5-2H3.5L2 19z"/>
</Icon>;

export const IconBike = (p) => <Icon {...p}>
  <circle cx="5.5" cy="17.5" r="3.5"/>
  <circle cx="18.5" cy="17.5" r="3.5"/>
  <path d="M5.5 17.5L10 9h5l3.5 8.5"/>
  <path d="M9 9h4"/>
  <path d="M15 9l-1 3"/>
</Icon>;

export const IconTablet = (p) => <Icon {...p}>
  <rect x="5" y="3" width="14" height="18" rx="1.8"/>
  <line x1="11" y1="18" x2="13" y2="18"/>
</Icon>;

export const IconCard = (p) => <Icon {...p}>
  <rect x="3" y="6" width="18" height="13" rx="1.8"/>
  <line x1="3" y1="10.5" x2="21" y2="10.5"/>
  <line x1="7" y1="15.5" x2="11" y2="15.5"/>
</Icon>;

export const IconCap = (p) => <Icon {...p}>
  <path d="M2 9l10-4 10 4-10 4-10-4z"/>
  <path d="M6 11v5c0 1.5 3 2.5 6 2.5s6-1 6-2.5v-5"/>
  <line x1="22" y1="9" x2="22" y2="14"/>
</Icon>;

export const IconTrophy = (p) => <Icon {...p}>
  <path d="M8 4h8v4a4 4 0 11-8 0V4z"/>
  <path d="M8 4H5v2a3 3 0 003 3"/>
  <path d="M16 4h3v2a3 3 0 01-3 3"/>
  <line x1="12" y1="12" x2="12" y2="16"/>
  <path d="M8 20h8l-1-4H9l-1 4z"/>
</Icon>;

export const IconAU = (p) => <Icon {...p}>
  <path d="M3 11c.5-2 2-3 4-3 1.5 0 2 1 3.5 1 1 0 1.5-1 3-1 2 0 3 2 5 2 1.5 0 2.5-1 3-1
           l-.5 4c-1 1.5-3 4-6 5-2 1-4 .5-6 .5s-3 1-5 0c-1.5-.5-2-2-2-4l1-3.5z"/>
  <circle cx="18" cy="17.5" r="0.6" fill="currentColor"/>
</Icon>;

export const IconUS = (p) => <Icon {...p}>
  <rect x="3" y="5" width="18" height="14" rx="1.5"/>
  <line x1="3" y1="8" x2="21" y2="8"/>
  <line x1="3" y1="11" x2="21" y2="11"/>
  <line x1="11" y1="14" x2="21" y2="14"/>
  <line x1="11" y1="17" x2="21" y2="17"/>
  <line x1="3" y1="14" x2="11" y2="14"/>
</Icon>;

export const IconBeach = (p) => <Icon {...p}>
  <path d="M12 21V11"/>
  <path d="M12 11c-2-3-6-3-8-1 1-1 5-1 8 1z"/>
  <path d="M12 11c2-3 6-3 8-1-1-1-5-1-8 1z"/>
  <path d="M12 11c-1-3 1-7 4-7-2 2-3 4-4 7z"/>
  <path d="M3 20c2 1 4-1 6 0s4-1 6 0 4-1 6 0"/>
</Icon>;

export const IconIsland = (p) => <Icon {...p}>
  <path d="M3 19c3 1 6-1 9 0s6-1 9 0"/>
  <path d="M8 16l3-5 2 3 1-2 2 4"/>
  <path d="M16 16V8"/>
  <path d="M16 8c-1-2-3-2-4-1 1 0 3 0 4 1z"/>
  <path d="M16 8c1-2 3-2 4-1-1 0-3 0-4 1z"/>
</Icon>;

export const IconCity = (p) => <Icon {...p}>
  <path d="M3 21V11l3-2v12"/>
  <path d="M6 21V7l4-3v17"/>
  <path d="M10 21V10l4 2v9"/>
  <path d="M14 21V13l3 2v6"/>
  <path d="M17 21V16l4 1v4"/>
  <line x1="2" y1="21" x2="22" y2="21"/>
</Icon>;

export const IconShipMini = (p) => <Icon {...p}>
  <path d="M3 17l1 3c.2.6.7 1 1.4 1h13.2c.7 0 1.2-.4 1.4-1l1-3H3z"/>
  <path d="M5 17V11h14v6"/>
  <path d="M8 11V8h8v3"/>
  <line x1="7" y1="14" x2="17" y2="14"/>
  <path d="M2 22c1.3.6 2.5-.5 4 0s3 .5 4 0 3-.5 4 0 3 .5 4 0"/>
</Icon>;

export const IconBuilding = (p) => <Icon {...p}>
  <path d="M3 21V10l9-5 9 5v11"/>
  <line x1="3" y1="21" x2="21" y2="21"/>
  <line x1="7" y1="21" x2="7" y2="13"/>
  <line x1="12" y1="21" x2="12" y2="13"/>
  <line x1="17" y1="21" x2="17" y2="13"/>
  <line x1="5" y1="13" x2="19" y2="13"/>
</Icon>;

export const IconCheck = (p) => <Icon {...p} strokeWidth={2}>
  <polyline points="4 12 10 18 20 6"/>
</Icon>;

export const IconStar = (p) => <Icon {...p}>
  <polygon points="12 2 14.6 8.5 21.5 9 16.2 13.5 18 20.5 12 16.7 6 20.5 7.8 13.5 2.5 9 9.4 8.5 12 2"/>
</Icon>;

export const IconArrowRight = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" stroke={color} strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const NGSIcons = {
  phone: IconPhone, laptop: IconLaptop, bike: IconBike,
  tablet: IconTablet, card: IconCard, cap: IconCap, trophy: IconTrophy,
  au: IconAU, us: IconUS,
  beach: IconBeach, island: IconIsland, city: IconCity,
  ship: IconShipMini, building: IconBuilding,
  check: IconCheck, star: IconStar, arrow: IconArrowRight,
};
