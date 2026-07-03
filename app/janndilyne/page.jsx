'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/entries/janndilyne.jsx').then(m => m.JanndilynePage), { ssr: false });

export default function Page() {
  return <Content />;
}
