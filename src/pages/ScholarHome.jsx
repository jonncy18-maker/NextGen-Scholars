import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { NGS_DATA } from '../../scholars-data.js';
import {
  IconExpenses, IconGrades, IconClock, IconIsland,
  IconBriefcase, IconTrophy, IconMessage, IconDocument, IconArrow,
} from '../components/ScholarIcons.jsx';
import { ScholarAIPanel } from '../components/ScholarAIPanel.jsx';

// Stage, tagline, and englishTarget are portal-specific copy that doesn't live in Supabase.
// name, trackCode, and semKey are derived from NGS_DATA to avoid duplication.
const CONFIGS = {
  claire: {
    stage: 'Year 2 · Semester 2',
    tagline: <>Four semesters to clear — <em>steady as you go.</em></>,
    englishTarget: 200,
  },
  april: {
    stage: 'Grade 11 · Semester 1',
    tagline: <>Trial period in progress — <em>one step at a time.</em></>,
    englishTarget: null,
  },
};

function buildConfig(key) {
  const s = NGS_DATA.scholars[key] || {};
  return {
    name: s.firstName || key,
    track: s.publicProfile?.trackName || s.track || '',
    trackCode: s.track || '',
    semKey: s.currentSem || '',
    expensesHref: `/entry?scholar=${key}`,
    gradesHref: `/${key}`,
    ...(CONFIGS[key] || {}),
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ScholarHome({ scholarKey }) {
  const config = buildConfig(scholarKey);
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    sessionStorage.setItem('ngs_auth_scholar', scholarKey);
  }, [scholarKey]);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: expenses }, { data: academics }, { data: scholars }, { data: englishData }] = await Promise.all([
          supabase.from('expenses')
            .select('date')
            .eq('scholar', scholarKey)
            .order('date', { ascending: false })
            .limit(1),
          supabase.from('academics')
            .select('gpa, status, sem')
            .eq('scholar', scholarKey)
            .order('id', { ascending: false }),
          supabase.from('scholars')
            .select('current_sem')
            .eq('scholar_key', scholarKey)
            .limit(1),
          supabase.from('english_sessions')
            .select('duration_minutes')
            .eq('scholar', scholarKey)
            .eq('sem', config.semKey),
        ]);

        const latestExpenseDate = expenses?.[0]?.date ?? null;
        const latestGpa = academics?.find(a => a.gpa != null)?.gpa ?? null;
        const gpaStatus = academics?.find(a => a.gpa != null)?.status ?? null;
        const milestonesRes = await supabase.from('milestones')
          .select('state')
          .eq('scholar', scholarKey)
          .eq('state', 'done');
        const rewardsCount = milestonesRes.data?.length ?? 0;
        const englishMinutes = englishData?.reduce((s, r) => s + (r.duration_minutes || 0), 0) ?? null;

        setLiveData({ latestExpenseDate, latestGpa, gpaStatus, rewardsCount, englishMinutes });
      } catch {
        setLiveData({});
      }
    }
    load();
  }, [scholarKey]);

  const lastEntry = liveData?.latestExpenseDate
    ? `Last entry · ${formatDate(liveData.latestExpenseDate)}`
    : 'Tap to add expenses';

  const gpaBlurb = liveData?.latestGpa != null
    ? <>GPA <b>{liveData.latestGpa.toFixed(2)}</b> · {liveData.gpaStatus === 'warn' ? 'near floor' : 'above floor'}</>
    : 'View your record';

  const rewardsCount = liveData?.rewardsCount ?? 0;

  const englishSub = (() => {
    if (!liveData) return 'Tracking hours';
    const mins = liveData.englishMinutes;
    if (mins === null || mins === undefined) return 'Log hours';
    const h = mins / 60;
    const display = h % 1 === 0 ? String(h) : h.toFixed(1);
    return config.englishTarget ? `${display} / ${config.englishTarget} hrs` : `${display} hrs`;
  })();

  const PRIMARY = [
    {
      key: 'expenses',
      icon: <IconExpenses size={25} />,
      label: 'Enter Expenses',
      blurb: lastEntry,
      href: config.expensesHref,
    },
    {
      key: 'grades',
      icon: <IconGrades size={25} />,
      label: 'View Grades',
      blurb: gpaBlurb,
      href: `/grades/${scholarKey}`,
    },
  ];

  const TRACKERS = [
    { key: 'english',  icon: <IconClock size={19} />,     label: 'English Hours',    sub: englishSub, href: `/english/${scholarKey}` },
    { key: 'vacation', icon: <IconIsland size={19} />,    label: 'Vacation Tracker', sub: 'Trip log', href: `/${scholarKey}#travel` },
    { key: 'career',   icon: <IconBriefcase size={19} />, label: 'Career Tracker',   sub: 'Pathway steps', href: null },
    { key: 'rewards',  icon: <IconTrophy size={19} />,    label: 'Rewards Tracker',  sub: `${rewardsCount} unlocked`, reward: true, href: `/${scholarKey}#milestones` },
    { key: 'messages', icon: <IconMessage size={19} />,   label: 'Messages',         sub: 'No new messages', href: null },
    { key: 'docs',     icon: <IconDocument size={19} />,  label: 'Documents',        sub: 'Files & records', href: null },
  ];

  return (
    <div className="sp-page">
      <div className="sp">
        <header className="sp-head">
          <div className="sp-track">
            <span className="sp-track-dot" />
            {config.track}
            <span className="sp-track-sep">·</span>
            {config.trackCode}
          </div>
          <p className="sp-greet-kicker">{getGreeting()}</p>
          <h1 className="sp-greet-name">{config.name}.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">{config.stage}</span>
            <p className="sp-tagline">{config.tagline}</p>
          </div>
        </header>

        <ScholarAIPanel scholarKey={scholarKey} />

        <section className="sp-section">
          <div className="sp-eyebrow">
            <span className="sp-eyebrow-rule" />
            Most used
          </div>
          <div className="sp-primary-grid">
            {PRIMARY.map(card => (
              <Link key={card.key} className="sp-card" to={card.href}>
                <div className="sp-card-icon">{card.icon}</div>
                <div className="sp-card-arrow"><IconArrow size={16} /></div>
                <div className="sp-card-label">{card.label}</div>
                <div className="sp-card-blurb">{card.blurb}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="sp-section is-trackers">
          <div className="sp-eyebrow">
            <span className="sp-eyebrow-rule" />
            Trackers
            <span className="sp-eyebrow-count">06</span>
          </div>
          <div className="sp-tracker-grid">
            {TRACKERS.map(tile => {
              const inner = (
                <>
                  <div className="sp-tile-icon">{tile.icon}</div>
                  <div className="sp-tile-body">
                    <div className="sp-tile-label">{tile.label}</div>
                    <div className="sp-tile-sub">{tile.sub}</div>
                  </div>
                </>
              );
              return tile.href
                ? <Link key={tile.key} className={`sp-tile${tile.reward ? ' is-reward' : ''}`} to={tile.href}>{inner}</Link>
                : <div key={tile.key} className={`sp-tile sp-tile--inactive${tile.reward ? ' is-reward' : ''}`}>{inner}</div>;
            })}
          </div>
        </section>

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
          <Link to="/" className="sp-home-link">← Home</Link>
        </footer>
      </div>
    </div>
  );
}
