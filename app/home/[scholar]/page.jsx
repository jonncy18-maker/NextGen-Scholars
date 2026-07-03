'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/ScholarHome.jsx').then(m => m.ScholarHome), { ssr: false });

export default function Page({ params }) {
  return <Content scholarKey={params.scholar || 'claire'} />;
}
