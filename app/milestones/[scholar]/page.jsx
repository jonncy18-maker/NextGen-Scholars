'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/MilestonesTracker.jsx').then(m => m.MilestonesTracker), { ssr: false });

export default function Page({ params }) {
  return <Content scholarKey={params.scholar || 'claire'} />;
}
