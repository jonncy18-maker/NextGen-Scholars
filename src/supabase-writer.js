// Write-back helpers using Supabase. All functions return Promises and
// throw on error so callers can surface failures in the UI.

import { supabase } from './lib/supabase.js';

export async function writeExpense(scholar, exp) {
  const { error } = await supabase.from('expenses').insert({
    id:      exp.id || `${scholar}_${exp.sem}_${Date.now()}`,
    scholar,
    sem:    exp.sem,
    item:   exp.item,
    cat:    exp.cat,
    amount: exp.amount,
    qty:    exp.qty,
    date:   exp.date,
    avb:    exp.avb,
    sent:   exp.sent,
    vendor: exp.vendor || '',
  });
  if (error) throw error;
}

export async function writeSent(id, _scholar) {
  const { error } = await supabase
    .from('expenses')
    .update({ sent: 'yes' })
    .eq('id', id);
  if (error) throw error;
}

export async function writeActionToggle(id, done) {
  const { error } = await supabase
    .from('actions')
    .update({ done })
    .eq('id', id);
  if (error) throw error;
}

export async function writeSemester(scholar, sem) {
  const { error } = await supabase
    .from('scholars')
    .update({ current_sem: sem })
    .eq('scholar_key', scholar);
  if (error) throw error;
}

export async function writeLog(entry) {
  // Future: insert into a `logs` table. For now, console only.
  console.log('[NGS log]', entry);
}
