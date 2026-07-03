'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../src/entries/home.jsx').then(m => m.HomeRoute), { ssr: false });

export default function Page() {
  return <Content />;
}
