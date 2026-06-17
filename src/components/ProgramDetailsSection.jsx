import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const DEFAULT_DETAILS = `NextGen Scholars (NGS) is a privately funded mentorship program that supports Filipino nursing students on a pathway toward international nursing licensure.

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

PROGRAM VALUES
- Student-centered, practical, and milestone-driven
- Grounded in real scholarship tracks (OET, NCLEX, AHPRA)
- Transparent progress tracking and accountability`;

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
