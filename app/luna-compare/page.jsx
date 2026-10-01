'use client';

import dynamic from 'next/dynamic';

const Content = dynamic(
  () => import('../../src/screens/LunaCompare.jsx').then((m) => m.LunaCompare),
  { ssr: false }
);

export default function Page() {
  return <Content />;
}
