'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/entries/claire.jsx').then(m => m.ClairePage), { ssr: false });

export default function Page() {
  return <Content />;
}
