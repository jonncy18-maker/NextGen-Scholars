'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/EnglishTracking.jsx').then(m => m.EnglishTracking), { ssr: false });

export default function Page({ params }) {
  return <Content scholarKey={params.scholar || 'claire'} />;
}
