'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(() => import('../../src/entries/sign-in.jsx').then(m => m.SignInTest), { ssr: false });

export default function Page() {
  return <Content />;
}
