import '../src/styles/base.css';
import '../src/styles/site.css';
import '../src/styles/profile.css';
import '../src/styles/navigator.css';
import '../src/styles/entry.css';
import '../src/styles/scholar-home.css';
import '../src/styles/english-tracking.css';
import '../src/styles/grade-entry.css';

import { ErrorBoundary } from '../src/components/ErrorBoundary.jsx';
import { BfcacheReload } from '../src/components/BfcacheReload.jsx';
import { RegisterSW } from '../src/components/RegisterSW.jsx';

export const metadata = {
  title: 'NextGen Scholars',
  // iOS ignores most of the manifest — appleWebApp fills the gap (scholars
  // are on Android, but this keeps Add-to-Home-Screen sane on iPhones too).
  appleWebApp: {
    capable: true,
    title: 'NGS',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#1B2A4A', // --ngs-navy
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Manrope:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BfcacheReload />
        <RegisterSW />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
