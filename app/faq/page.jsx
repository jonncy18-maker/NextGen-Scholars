'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/screens/FAQPage.jsx').then(m => m.FAQPage), { ssr: false });

export default function Page() {
  return <Content />;
}
