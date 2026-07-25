'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../../src/entries/navigator.jsx').then(m => m.Navigator), { ssr: false });

export default function Page({ params }) {
  // params is a Promise in Next 15+; a client page cannot be async,
  // so unwrap it with React.use() rather than awaiting.
  const { slug } = use(params);
  return <Content slug={slug || []} />;
}
