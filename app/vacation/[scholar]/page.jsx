'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/VacationTracker.jsx').then(m => m.VacationTracker), { ssr: false });

export default function Page({ params }) {
  return <Content scholarKey={params.scholar || 'claire'} />;
}
