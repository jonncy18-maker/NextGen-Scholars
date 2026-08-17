'use client';

import dynamic from 'next/dynamic';

// TEMPORARY — delete this route and src/entries/setup-demo.jsx once the demo
// scholar's Better Auth account has been created. See that file's header.
const Content = dynamic(() => import('../../src/entries/setup-demo.jsx').then(m => m.SetupDemoPage), { ssr: false });

export default function Page() {
  return <Content />;
}
