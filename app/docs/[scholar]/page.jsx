'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/ScholarDocuments.jsx').then(m => m.ScholarDocuments), { ssr: false });

export default function Page({ params }) {
  return <Content scholarKey={params.scholar || 'claire'} />;
}
