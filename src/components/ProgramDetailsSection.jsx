import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const DEFAULT_DETAILS = `NEXTGEN SCHOLARS — PROGRAM DETAILS

NextGen Scholars (NGS) is a privately funded mentorship program that supports Filipino nursing students on a pathway toward international nursing licensure.

PATHWAY
1. Philippines — complete BSN (Bachelor of Science in Nursing) or Grade 11 pre-nursing
2. OET — Occupational English Test (Band 350+ required for AHPRA eligibility)
3. NCLEX-RN — US nursing licensure board exams
4. AHPRA — Australian Health Practitioner Regulation Agency registration (Australia)

TRACKS
- BSN Track: for active nursing degree students in the Philippines
- Pre-nursing Track: for Grade 11 students on the science/nursing pathway

WHAT MENTORSHIP INCLUDES
- One-on-one guidance from a dedicated program mentor
- Study planning and milestone tracking
- OET English proficiency preparation support
- Academic progress monitoring
- Application and licensure pathway guidance
- Program support to help scholars reach each milestone

WHO CAN APPLY
- Motivated Filipino nursing students (BSN or Grade 11)
- Must be serious about pursuing an international nursing career
- Applications are reviewed individually; the program is small and selective

HOW TO APPLY
- Complete the application form on the NextGen Scholars website
- The mentor reviews all applications and contacts shortlisted candidates
- Shortlisted applicants go through a brief interview/assessment

---

US IMMERSION PROGRAM

NextGen Scholars includes a structured 3-month US Immersion experience as part of the scholar development pathway.

OVERVIEW
The US Immersion is a professional and cultural exchange experience designed to transform competence into confidence through real-world exposure. Scholars gain cultural immersion, professional growth, leadership development, and English mastery across diverse US environments.

VISION
Gain exposure through real-world immersion, cultural connection, English mastery, and self-leadership across diverse US environments.

OBJECTIVES
- Cultural Immersion: Experience the rhythm of everyday US life — from New York's energy to Nashville's southern charm.
- Professional & Personal Growth: Think, speak, live in English. Build independence, adaptability, and confidence while learning from diverse communities.
- Leadership & Global Mindset: Cultivate resilience, adaptability, and purpose — the foundation of future-ready global citizens.

EXPECTED OUTCOMES
- Enhanced adaptability
- Deeper understanding of US culture
- Strengthened independence and initiative
- Functional English Proficiency (B2+)
- Increased confidence and self-leadership

TRAVEL ITINERARY
The immersion follows a structured journey across the United States:
1. New York City, NY — 3 days (global exposure, first city on arrival)
2. Carmel, IN — Visit Alexandria, Anderson, Carmel & Fishers; Indianapolis Zoo
3. Chicago, IL — Architectural discovery, structured big city experience (weekend)
4. Mammoth Cave, KY — Historical landmark, rural Kentucky exposure (weekend)
5. King's Island, OH — Theme park experience, Midwest culture (weekend)
6. Nashville, TN — Southern charm, live country music (weekend)
7. Miami, FL & Caribbean Cruise — Latin-American culture, 7-day Caribbean cruise (week-long)
8. Return to Cebu

STUDY DURING IMMERSION
Scholars continue structured NCLEX study throughout the immersion:
- 6-8 study sessions per week
- 3-4 hours per day of guided self-review and flashcard recall
- Mock practice and self-tracking
- Resources: CBRC-Hybrid (recorded lectures, digital handouts, module quizzes, score tracking, mock exams, mobile app)
- All CBRC Hybrid resources remain fully available overseas; in-person review completed upon return to the Philippines

US ORIENTATION
Scholars are prepared for US daily life covering:
- US Geography: 4 time zones, major regions (Northeast, South, Midwest, West)
- Financial System: Cashless culture (cards, Apple Pay, tap-to-pay), sales tax 6-10% added at checkout, tipping 15-20% expected at restaurants and services
- Climate: Varies by region — cold winters in Midwest/Northeast, mild West Coast, hot humid summers in the South

US VISA REQUIREMENTS
The US Immersion requires a student visa. To be eligible, scholars must meet:
1. Good academic standing — minimum grade floor of 81% (this threshold is adjustable by the mentor based on individual circumstances)
2. Satisfactory completion of the Summer English Bootcamp held the summer before the visa interview — this is required for two reasons:
   a. To improve the scholar's English proficiency ahead of the trip
   b. To prepare the scholar for the in-person US visa interview, maximizing the likelihood of approval
   Note: The bootcamp preparation process can be intensive.

ELIGIBILITY FOR US IMMERSION
The US Immersion program is available exclusively to NGN (nursing) scholars. It is not available to scholars on other tracks.

---

PROGRAM VALUES
- Student-centered, practical, and milestone-driven
- Grounded in real scholarship tracks (OET, NCLEX, AHPRA)
- Transparent progress tracking and accountability
- Global exposure as a core pillar of scholar development`;

const CONFIG_KEY = 'program_details';

export function ProgramDetailsSection({ id, collapsed, onToggle }) {
  const [details, setDetails]   = useState('');
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState('');
  const [saving,  setSaving]    = useState(false);
  const [status,  setStatus]    = useState(null); // 'saved' | 'error'
  const [loaded,  setLoaded]    = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();
    setDetails(data?.value ?? DEFAULT_DETAILS);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setDraft(details);
    setEditing(true);
    setStatus(null);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft('');
    setStatus(null);
  }

  async function handleSave() {
    setSaving(true); setStatus(null);
    const { error } = await supabase
      .from('config')
      .upsert({ key: CONFIG_KEY, value: draft }, { onConflict: 'key' });
    setSaving(false);
    if (error) { setStatus('error'); return; }
    setDetails(draft);
    setEditing(false);
    setDraft('');
    setStatus('saved');
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Program Details
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="pgd-body">
          <div className="section-head">
            <h2 className="section-title">Public AI — Program Details</h2>
            <span className="section-note">This text is what the public "Ask AI" chat knows about the program.</span>
          </div>

          {!loaded && <div className="pgd-loading">Loading…</div>}

          {loaded && !editing && (
            <div className="pgd-view">
              <pre className="pgd-pre">{details}</pre>
              <div className="pgd-actions">
                <button className="pgd-edit-btn" onClick={startEdit}>Edit details</button>
                {status === 'saved' && <span className="pgd-saved-msg">Saved</span>}
              </div>
            </div>
          )}

          {loaded && editing && (
            <div className="pgd-editor">
              <textarea
                className="pgd-textarea"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={24}
                spellCheck
              />
              <div className="pgd-editor-note">
                Write in plain text. Use ALL CAPS headings and dashes for lists. The AI reads this verbatim.
              </div>
              {status === 'error' && <p className="pgd-error">Save failed — check your connection.</p>}
              <div className="pgd-actions">
                <button className="pgd-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="pgd-cancel-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
