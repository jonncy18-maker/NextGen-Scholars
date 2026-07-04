import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useMediaQuery } from './useMediaQuery.js';

// Public + unauthenticated — GET /api/public/profile/:key returns a curated
// whitelist (never raw expense rows, notes, alerts, or other scholars'
// data), replacing the old loadFromSupabase() call that pulled the entire
// Supabase dataset through the anon key for every anonymous visitor.
export function useScholarProfile(scholarKey, staticData, staticScholar, mergeFn) {
  const isDesktop = useMediaQuery('(min-width: 960px)');
  const [profileData, setProfileData] = useState(() => mergeFn(staticData, staticScholar));

  useEffect(() => {
    api.get(`/public/profile/${scholarKey}`)
      .then(data => setProfileData(mergeFn(staticData, data)))
      .catch(() => setProfileData(mergeFn(staticData, staticScholar)));
  }, [scholarKey]);

  return { profileData, isMobile: !isDesktop };
}
