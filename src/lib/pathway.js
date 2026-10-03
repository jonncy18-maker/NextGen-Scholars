// Pathway stages per program track — the one place this mapping lives.
//
// `scholars.track` is free text (db/schema.sql has no constraint), so this
// module owns the vocabulary: NGN (nursing) and NGH (hospitality) have a
// pathway; anything else — null, '', 'none', or a legacy value such as
// 'TESDA' — means "not on a track" and the Home strip is simply omitted.
//
// The current stage is DERIVED from data John's team already maintains
// (scholars.status, scholars.current_sem, career_steps). Nothing here invents a
// figure: when a stage's progress can't be derived it is shown without one.

// What a mentor may assign, and what the API / AI tool accept. `null` is stored
// for "not on a track".
export const TRACK_OPTIONS = ['NGN', 'NGH'];

export const TRACK_LABELS = {
  NGN: 'NGN · Nursing',
  NGH: 'NGH · Hospitality',
};

// Strict parse for WRITES (mentor API + AI tool). Returns 'NGN' | 'NGH' | null
// (null = not on a track) or throws on anything else, so a typo can't silently
// store free text that would then read as "no track".
export function parseTrackInput(raw) {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (v === '' || v.toLowerCase() === 'none') return null;
  const hit = TRACK_OPTIONS.find((t) => t.toLowerCase() === v.toLowerCase());
  if (!hit) {
    throw new Error(`Unknown track "${raw}". Valid: ${TRACK_OPTIONS.join(', ')}, or none.`);
  }
  return hit;
}

// Lenient normalisation for READS: unknown values (incl. 'TESDA') -> null.
export function normalizeTrack(raw) {
  try {
    return parseTrackInput(raw);
  } catch {
    return null;
  }
}

const STAGES = {
  NGN: [
    { key: 'trial', label: 'Trial' },
    { key: 'bsn', label: 'BSN' },
    { key: 'oet', label: 'OET' },
    { key: 'nclex', label: 'NCLEX' },
    { key: 'ahpra', label: 'AHPRA' },
  ],
  NGH: [
    { key: 'trial', label: 'Trial' },
    { key: 'tesda', label: 'TESDA' },
    { key: 'assessment', label: 'Assessment' },
  ],
};

const BSN_YEARS = 4;

// 'Y3S1' -> bsn year 3; 'TG11S2' -> grade 11; 'Entry' -> entry (trial admission);
// 'PostY1' -> post; anything else -> null (can't derive).
function parseSem(sem) {
  const s = String(sem || '').trim();
  let m = /^Y([1-9])S[12]$/i.exec(s);
  if (m) return { kind: 'bsn', year: Number(m[1]) };
  m = /^TG(1[12])S[12]$/i.exec(s);
  if (m) return { kind: 'grade', grade: Number(m[1]) };
  if (/^entry$/i.test(s)) return { kind: 'entry' };
  if (/^PostY[1-9]$/i.test(s)) return { kind: 'post' };
  return null;
}

const isDone = (st) => st === 'passed' || st === 'waived';

// derivePathway({ track, status, currentSem, careerSteps }) ->
//   null when the scholar has no pathway, otherwise
//   { track, stages: [{ key, label, state: 'done'|'current'|'future', detail }],
//     current, next, summary, doneCount }
// `careerSteps` is the career_steps rows array ([{ step, status }]); it may be
// empty/undefined (production currently holds a single row).
export function derivePathway({ track, status, currentSem, careerSteps }) {
  const t = normalizeTrack(track);
  if (!t) return null;

  const steps = {};
  (careerSteps || []).forEach((r) => {
    if (r?.step) steps[r.step] = r.status;
  });
  const sem = parseSem(currentSem);
  const inTrial = String(status || '').toLowerCase() === 'trial';
  const hasStatus = !!status;

  // Trial: a recorded Trial Period step wins. Otherwise a scholar who is no
  // longer 'trial' and sits in a BSN/post year has demonstrably passed it.
  const trialRecorded = steps['Trial Period'] != null;
  let trialDone;
  if (trialRecorded) trialDone = isDone(steps['Trial Period']);
  else if (t === 'NGN') trialDone = !inTrial && (sem?.kind === 'bsn' || sem?.kind === 'post');
  else trialDone = hasStatus && !inTrial;

  const done = { trial: trialDone };
  const detail = {};

  if (t === 'NGN') {
    done.bsn = isDone(steps.PNLE);
    done.oet = isDone(steps.OET);
    done.nclex = isDone(steps.NCLEX);
    done.ahpra = isDone(steps.AHPRA);

    if (inTrial && !trialDone) {
      if (sem?.kind === 'grade') detail.trial = `Grade ${sem.grade} trial`;
    }
    if (sem?.kind === 'bsn' && sem.year <= BSN_YEARS) {
      detail.bsn = `Year ${sem.year} of ${BSN_YEARS}`;
    }
    if (steps.PNLE === 'in_progress') {
      detail.bsn = detail.bsn ? `${detail.bsn} · PNLE in progress` : 'PNLE in progress';
    }
    if (steps.OET === 'in_progress') detail.oet = 'OET in progress';
    if (steps.OET === 'failed') detail.oet = 'OET retake';
    if (steps.NCLEX === 'in_progress') detail.nclex = 'NCLEX in progress';
    if (steps.NCLEX === 'failed') detail.nclex = 'NCLEX retake';
    if (isDone(steps.OSCE) && !done.ahpra) detail.ahpra = 'OSCE passed';
    else if (steps.OSCE === 'in_progress') detail.ahpra = 'OSCE in progress';
  } else {
    // NGH has no career_steps vocabulary and no per-stage data source, so the
    // TESDA and Assessment stages can't be marked done from data yet.
    done.tesda = false;
    done.assessment = false;
  }

  const defs = STAGES[t];
  const currentKey = defs.find((d) => !done[d.key])?.key ?? null;
  const stages = defs.map((d) => ({
    key: d.key,
    label: d.label,
    state: done[d.key] ? 'done' : d.key === currentKey ? 'current' : 'future',
    detail: detail[d.key] || null,
  }));

  const current = stages.find((s) => s.state === 'current') || null;
  const next = current
    ? stages.find((s) => s.state === 'future' && stages.indexOf(s) > stages.indexOf(current)) ||
      null
    : null;

  let summary;
  if (!current) summary = 'Pathway complete';
  else {
    const lead = current.detail || `${current.label} stage`;
    summary = next ? `${lead} · next: ${next.label}` : lead;
  }

  return {
    track: t,
    stages,
    current,
    next,
    summary,
    doneCount: stages.filter((s) => s.state === 'done').length,
  };
}
