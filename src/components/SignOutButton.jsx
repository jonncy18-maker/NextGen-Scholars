'use client';

import { authClient, invalidateToken } from '../lib/auth-client.js';

export function SignOutButton({ onSignOut, className = 'sp-signout', children = 'Sign out' }) {
  async function handleClick() {
    invalidateToken();
    await authClient.signOut();
    onSignOut();
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
