'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/entries/navigator.jsx').then(m => m.Navigator), { ssr: false });

export default function Page({ params }) {
  return <Content slug={params.slug || []} />;
}
