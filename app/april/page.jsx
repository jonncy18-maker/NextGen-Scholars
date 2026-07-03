'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/entries/april.jsx').then(m => m.AprilPage), { ssr: false });

export default function Page() {
  return <Content />;
}
