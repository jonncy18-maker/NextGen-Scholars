import React from 'react';

// Thin-stroke line icons for the dashboard shells (sidebar, topbar, stat
// cards). One shared base so every icon inherits currentColor and scales
// off a single size prop — mirrors ScholarIcons.jsx's approach.
function I({ size = 16, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IcnGrid = (p) => (
  <I {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.4" />
    <rect x="14" y="3" width="7" height="7" rx="1.4" />
    <rect x="3" y="14" width="7" height="7" rx="1.4" />
    <rect x="14" y="14" width="7" height="7" rx="1.4" />
  </I>
);

export const IcnUsers = (p) => (
  <I {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 5.6M17.8 15.4c1.6.7 2.6 2.2 3 4.6" />
  </I>
);

export const IcnRoute = (p) => (
  <I {...p}>
    <circle cx="6" cy="19" r="2.2" />
    <circle cx="18" cy="5" r="2.2" />
    <path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8" />
  </I>
);

export const IcnWallet = (p) => (
  <I {...p}>
    <rect x="3" y="6" width="18" height="14" rx="2.4" />
    <path d="M3 10h18M16.5 15h.01" />
  </I>
);

export const IcnBook = (p) => (
  <I {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </I>
);

export const IcnGlobe = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18" />
  </I>
);

export const IcnClock = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </I>
);

export const IcnStar = (p) => (
  <I {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5z" />
  </I>
);

export const IcnPlane = (p) => (
  <I {...p}>
    <path d="M10.5 13.5L3 11l1.5-2 6 1L16 4.5 18.5 5l-3 6.5 4.5 1.5-1.5 2-5-1-2 4.5-2-.5.5-4.5z" />
  </I>
);

export const IcnDoc = (p) => (
  <I {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </I>
);

export const IcnPie = (p) => (
  <I {...p}>
    <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />
    <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5z" />
  </I>
);

export const IcnSparkle = (p) => (
  <I {...p}>
    <path d="M12 4l1.8 4.6L18 10.4l-4.2 1.8L12 17l-1.8-4.8L6 10.4l4.2-1.8L12 4z" />
    <path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
  </I>
);

export const IcnRefresh = (p) => (
  <I {...p}>
    <path d="M20 11a8 8 0 1 0-1.8 6.1" />
    <path d="M20 5v6h-6" />
  </I>
);

export const IcnUpdate = (p) => (
  <I {...p}>
    <path d="M12 3v11" />
    <path d="M7.5 10L12 14.5 16.5 10" />
    <path d="M4.5 16.5v2A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5v-2" />
  </I>
);

export const IcnMenu = (p) => (
  <I {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </I>
);

export const IcnX = (p) => (
  <I {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
);

export const IcnSignOut = (p) => (
  <I {...p}>
    <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
    <path d="M11 12h9M17 8.5L20.5 12 17 15.5" />
  </I>
);

export const IcnChevron = (p) => (
  <I {...p}>
    <path d="M9 6l6 6-6 6" />
  </I>
);

export const IcnExternal = (p) => (
  <I {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </I>
);

export const IcnHome = (p) => (
  <I {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-6h4v6" />
  </I>
);
