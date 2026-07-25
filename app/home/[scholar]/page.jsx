'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/screens/ScholarHome.jsx').then(m => m.ScholarHome), { ssr: false });

export default function Page({ params }) {
  // params is a Promise in Next 15+; a client page cannot be async,
  // so unwrap it with React.use() rather than awaiting.
  const { scholar } = use(params);
  return <Content scholarKey={scholar || 'claire'} />;
}
