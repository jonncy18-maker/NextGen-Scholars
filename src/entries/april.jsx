import React from 'react';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarProfile } from '../components/Profile/ScholarProfile.jsx';
import { useScholarProfile } from '../hooks/useScholarProfile.js';
import { scholarTotals } from '../utils.js';

const STATIC = NGS_DATA.scholars.april.publicProfile;
const STATIC_SCHOLAR = NGS_DATA.scholars.april;

function mergeSheetData(base, s) {
  if (!s) return base;
  const tots = scholarTotals(s);

  return {
    ...base,
    support: {
      ...base.support,
      total: {
        ...base.support.total,
        rawPhp: tots.total > 0 ? tots.total : base.support.total.rawPhp,
        detail: base.support.total.detail,
      },
    },
    milestones: s.milestones?.length
      ? s.milestones.map((m, i) => {
          const stat = base.milestones[i] || {};
          return { ...stat, state: m.state === 'done' ? 'done' : 'future' };
        })
      : base.milestones,
  };
}

export function AprilPage() {
  const { profileData, isMobile } = useScholarProfile('april', STATIC, STATIC_SCHOLAR, mergeSheetData);
  return <ScholarProfile data={profileData} isMobile={isMobile} relatedProfiles={[{ name: 'Claire', href: '/claire' }]} />;
}
