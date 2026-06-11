import { useState, useEffect } from 'react';
import { loadFromSupabase } from '../supabase-loader.js';
import { useMediaQuery } from './useMediaQuery.js';

export function useScholarProfile(scholarKey, staticData, staticScholar, mergeFn) {
  const isDesktop = useMediaQuery('(min-width: 960px)');
  const [profileData, setProfileData] = useState(() => mergeFn(staticData, staticScholar));

  useEffect(() => {
    loadFromSupabase()
      .then(data => {
        if (data.scholars?.[scholarKey]) {
          setProfileData(mergeFn(staticData, data.scholars[scholarKey]));
        }
      })
      .catch(() => setProfileData(mergeFn(staticData, staticScholar)));
  }, [scholarKey]);

  return { profileData, isMobile: !isDesktop };
}
