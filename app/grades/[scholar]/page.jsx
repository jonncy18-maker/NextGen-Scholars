'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/GradeEntry.jsx').then(m => m.GradeEntry), { ssr: false });

export default function Page({ params }) {
  return <Content scholarKey={params.scholar || 'claire'} />;
}
