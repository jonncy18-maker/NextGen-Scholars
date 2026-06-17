import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const DEFAULT_DETAILS = `NEXTGEN SCHOLARS — PROGRAM DETAILS
Nursing Generational Scholarship (NGS)

PURPOSE
To lift a family out of generational poverty. To give scholars a life of dignity where potential is never limited by circumstance. The purpose is not just to fund education — it is to rewrite what is possible for a Filipino family. Each scholar represents proof that poverty can end with one generation that chooses discipline over despair.

GOAL
To develop nurses of the world — not just by profession, but by mindset and heart. Scholars are trained to think globally and act with compassion: competent professionals, responsible citizens, and people of character who carry their Filipino roots while adapting globally.

MUTUAL PROMISE
- Mentor's part: To give opportunity, guidance, and structure
- Scholar's part: To honor the opportunity with discipline, integrity, and honesty
One generation lifts another.

---

TRACKS
NextGen Nurses (NGN): Full university BSN pathway (4 years) to international nursing licensure. Target: USA hospital placements and/or Australian AHPRA registration.
NextGen Hospitality (NGH): Vocational pathway from English fluency to luxury hotel or international cruise placement.

PATHWAY (NGN)
1. Philippines — complete BSN (Bachelor of Science in Nursing) or Grade 11 pre-nursing
2. PRC board licensure (Philippine nursing license)
3. OET — Occupational English Test (Grade B required for AHPRA and NCLEX eligibility)
4. NCLEX-RN — US nursing licensure board exams
5. AHPRA — Australian Health Practitioner Regulation Agency registration
6. Hospital placement in USA, Australia, or Singapore

---

PROGRAM VALUES
- Communication: Communicate anything important, promptly
- Honesty: Tell the truth, even when it's hard
- Grit: Keep going even when things are difficult
- Humility: Regardless of where you are, never forget where you came from
- Help Others: When you become successful, mentor the next generation

---

SCHOLAR REQUIREMENTS

Academic:
- Grades are accessible via the university's student portal — reviewed directly from the platform
- Maintain an average of 85% or higher
- Inform mentor about upcoming projects and academic requirements
- If grades drop below 85%, report immediately — honesty is the most important thing

Expenses:
- Notify mentor as soon as any school-related expense comes up
- Send photos of receipts (tuition, uniform, etc.)
- Detailed expense records maintained with semester summaries
- Tools: Cebuana Card (cash), authorized credit card (after 2nd year college)

Communication:
- Send regular updates on academic and personal progress
- Share school schedule at the start of each semester
- Notify mentor in advance of any important changes

Integrity:
- Always be honest about studies and needs
- Never hide or delay important updates
- Integrity is not perfection — it is the courage to stay honest

---

PROGRAM TIMELINE

Trial Period (Grade 11–12):
- Scholar identified; family interviewed; expectations set
- Small, selective financial support begins (school essentials)
- Evaluated for full program entry at end of Grade 12
- Reward: smartphone + phone plan at start of Grade 11

Year 1 College:
- Full scholarship begins (tuition, books, uniforms, supplies)
- Mentor check-ins and communication structure established
- Travel: Boracay + Bohol trip (celebrating graduation, entering university)

Year 2 College:
- Authorized credit card access begins
- Travel: Hong Kong/Bangkok trip — scholar takes on role of travel leader

Year 3 College:
- Travel: Royal Caribbean Cruise — scholar leads the experience

After College Graduation:
- 3-month U.S. Immersion (multi-city cultural and professional program)
- NCLEX study continues during immersion
- Scholar begins mentoring younger program participants

2 Years Post-Graduation (Philippines):
- Clinical experience in a Philippine hospital
- Begin 1-year Australia immigration process (AHPRA registration)

6–7 Years Post-Graduation:
- Working as a registered nurse in Australia
- Continuing to mentor future scholars

---

MILESTONE REWARDS (in order)
1. Starting Grade 11: Brand-new mid-level smartphone + phone plan
2. Finishing Grade 12: Chromebook (brand new, good quality)
3. Finishing Grade 12: e-Bike (primarily for college transport)
4. Finishing 1st year college: iPhone or Samsung Galaxy (3-year-old model)
5. Finishing 2nd year college: iPad or Android tablet (for note-taking)
6. Finishing 2nd year college: Authorized credit card (connected to mentor's account)

Rewards are not gifts — they are milestones of integrity, effort, and growth.

---

TRAVEL PROGRAM OVERVIEW

Every trip has an educational, cultural, and character-building purpose.

Travel Timeline:
1. Boracay — After 1st year college. Celebrate graduation.
2. Bohol — After 1st year college. Domestic natural beauty and culture.
3. Hong Kong/Bangkok — After 2nd year college. First international trip. Scholar leads the group.
4. Royal Caribbean Cruise — After 3rd year college. Scholar leads.
5. 3-Month U.S. Immersion — After college graduation. Multi-city program.

---

US IMMERSION PROGRAM

Available exclusively to NGN (nursing) scholars.

VISION
Gain exposure through real-world immersion, cultural connection, English fluency, and self-leadership across diverse American environments.

OBJECTIVES
- Cultural Immersion: Experience the rhythm of everyday US life — from New York's energy to Nashville's southern charm
- Professional & Personal Growth: Think, speak, live in English; build independence, adaptability, and confidence
- Leadership & Global Mindset: Cultivate resilience, adaptability, and purpose

EXPECTED OUTCOMES
- Enhanced adaptability
- Deeper understanding of US culture
- Strengthened independence and initiative
- Functional English Proficiency (B2+) — foundation for OET Grade B
- Increased confidence and self-leadership

TRAVEL ITINERARY (US Immersion)
1. New York City, NY — 3 days (global exposure, first city on arrival)
2. Carmel, IN — Visit to personal roots; Indianapolis Zoo
3. Chicago, IL — Architectural discovery, big city experience (weekend)
4. Mammoth Cave, KY — National historic landmark, rural Kentucky (weekend)
5. King's Island, OH — Theme park, Midwest culture (weekend)
6. Nashville, TN — Southern charm, live country music (weekend)
7. Miami, FL + 7-day Caribbean Cruise — Latin American culture (week-long)
8. Return to Cebu

STUDY DURING IMMERSION
- 6–8 study sessions per week
- 3–4 hours per day of guided self-review and flashcard recall
- Platform: CBRC-Hybrid (video lectures, quizzes, mock exams, mobile app)
- Study environments: hotel room, hotel business center, cafés

US FINANCIAL SYSTEM
- Cashless culture — cards, Apple Pay, and tap-to-pay are standard
- Sales tax: 6–10% added at checkout (price on shelf is not final price)
- Tips: 15–20% expected at restaurants, salons, and ride services

US VISA REQUIREMENTS
- Good academic standing (minimum 81% grade floor)
- Satisfactory completion of Summer English Bootcamp before visa interview
- Bootcamp prepares scholar for both English proficiency and the in-person visa interview

---

ENGLISH & OET

OET (Occupational English Test) is the preferred English exam for nurses migrating to Australia or the US. It is designed specifically for healthcare professionals. Minimum Grade B required by AHPRA and NCLEX state boards.

Daily English Practice:
- Listening: Podcasts or YouTube (15–30 min/day)
- Reading: Short articles or stories in English
- Speaking: Weekly calls with mentor + daily practice with ChatGPT Advanced Voice Mode
- Writing: Reflections in a daily journal

English Development Stages:
- Early: Writing in English in Messenger
- Stage 3: All mentor communication exclusively in English
- Summer Bootcamp: Intensive practice before U.S. visa interview
- OET Prep: Structured preparation in Reading, Listening, Writing, Speaking

---

INTERNATIONAL TRAVEL — GENERAL RULES

Required Documents:
- Valid passport
- Visa stamped in passport (if applicable)
- Boarding pass
- Travel itinerary (flights, hotel, emergency contacts)
- Travel medical insurance (digital or printed)

Passport Process (Philippines):
- DFA application handled by mentor; scholar provides personal information
- Appointment at DFA SM Seaside Cebu City (3F, Mountain Wing)
- Processing time: 2–3 weeks
- Pickup at Robinson Galleria with claim stub and valid ID

Luggage Rules:
- Carry-on maximum: 7 kg
- No sharp objects in carry-on
- No fruits or vegetables (cross-border restrictions)
- Liquids in carry-on: 100 ml per container maximum

Airport Procedure:
- Arrive 3 hours before international flights
- Security: remove shoes, belt, electronics, and liquids
- Immigration: present documents; always be honest with officers

Travel Technology:
- eSIM: Holafly (unlimited data) or Airalo (more affordable)
- Download Google Maps offline maps for destination
- Download Uber/Grab for local transport
- Download airline app and register flight

Credit Card During Travel:
- Authorized use: group meals, tickets, transportation, group souvenirs
- Prohibited: personal shopping, gifts, cash advances (20%+ interest)
- Always pay in local currency — never in USD when given the option
- Track all expenses using Credit Karma app

---

COUNTRY RULES

Hong Kong:
- No eating/drinking on MTR or in Ubers (Fine: ₱15,000 / up to 6 months prison)
- No spitting in public (Fine: ₱23,000)
- No littering (Fine: ₱23,000 / up to 6 months prison)
- Cross only at pedestrian crossings on green (Fine: ₱38,000 / up to 3 months)
- Phone on silent in public
- No laundry in hotel rooms
- Transport: MTR uses Octopus card

Singapore:
- No spitting (Fine: ₱225,000 / up to 8 weeks prison)
- No chewing gum — illegal (Fine: ₱450,000 / up to 1 year prison)
- No eating on MRT or in stations (Fine: up to ₱22,000)
- Littering (Fine: ₱450,000 / up to 3 months)
- No feeding wild animals (Fine: up to ₱90,000)
- No jaywalking (Fine: ₱90,000 / up to 6 months)
- No laundry in hotel rooms (Fine: up to ₱450,000)
- CCTV cameras are everywhere; rules are strictly enforced
- Transport: MRT uses EZ-Link card or tap credit card

---

WHO CAN APPLY
- Motivated Filipino nursing students (BSN or Grade 11 pre-nursing)
- Must be serious about pursuing an international nursing career
- Applications are reviewed individually; the program is small and selective
- Applications accepted from: teachers, family, parish leaders, or scholars themselves

HOW TO APPLY
- Complete the nomination form on the NextGen Scholars website
- Mentor reviews all applications and contacts shortlisted candidates
- Shortlisted applicants go through a brief interview and assessment`;

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
