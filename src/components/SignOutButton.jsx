'use client';

import { useRouter } from 'next/navigation';
import { authClient, invalidateToken } from '../lib/auth-client.js';

export function SignOutButton({ onSignOut, className = 'sp-signout', children = 'Sign out' }) {
  const router = useRouter();
  async function handleClick() {
    invalidateToken();
    await authClient.signOut();
    onSignOut?.();
    // Leave the scholar-specific auth gate behind — send the user to the
    // generic /login, which resolves their destination from credentials.
    router.replace('/login');
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
