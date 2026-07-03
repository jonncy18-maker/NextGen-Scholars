'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/entries/entry.jsx').then(m => m.EntryApp), { ssr: false });

export default function Page() {
  return <Content />;
}
