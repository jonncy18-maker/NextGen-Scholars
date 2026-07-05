'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/entries/login.jsx').then(m => m.LoginPage), { ssr: false });

export default function Page() {
  return <Content />;
}
