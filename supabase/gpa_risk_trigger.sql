-- GPA Risk Alert Trigger
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new
--
-- Fires after every INSERT or UPDATE of gpa on the academics table.
-- Upserts (or clears) a row in the alerts table based on how close the
-- scholar's GPA is to their floor from scholars.gpa_floor.
--
-- Alert IDs are stable: gpa_risk_{scholar_key}_{sem} — so the same row
-- is updated in place when a GPA is corrected, and deleted when it recovers.

create or replace function ngs_check_gpa_risk()
returns trigger language plpgsql security definer as $$
declare
  v_floor      numeric;
  v_first_name text;
  v_gpa        numeric;
  v_alert_id   text;
  v_severity   text;
  v_title      text;
  v_sub        text;
begin
  if new.gpa is null then
    return new;
  end if;

  v_gpa      := new.gpa;
  v_alert_id := 'gpa_risk_' || new.scholar || '_' || replace(coalesce(new.sem, 'unknown'), ' ', '_');

  select gpa_floor, first_name
    into v_floor, v_first_name
    from scholars
   where scholar_key = new.scholar;

  -- No floor configured — nothing to evaluate
  if v_floor is null then
    return new;
  end if;

  if v_gpa <= v_floor then
    v_severity := 'critical';
    v_title    := coalesce(v_first_name, new.scholar) || ' — GPA at or below minimum floor';
    v_sub      := 'GPA ' || round(v_gpa, 1) || '% ≤ floor ' || v_floor
                  || '% (' || coalesce(new.sem, '?') || ') · immediate intervention required';
  elsif v_gpa <= v_floor + 5 then
    v_severity := 'warning';
    v_title    := coalesce(v_first_name, new.scholar) || ' — GPA within 5 points of floor';
    v_sub      := 'GPA ' || round(v_gpa, 1) || '% · floor ' || v_floor
                  || '% (' || coalesce(new.sem, '?') || ') · monitor closely';
  else
    -- GPA is safely above the threshold — remove any existing alert for this scholar/sem
    delete from alerts where id = v_alert_id;
    return new;
  end if;

  insert into alerts (id, severity, icon, scholar, title, sub)
  values (v_alert_id, v_severity, null, new.scholar, v_title, v_sub)
  on conflict (id) do update set
    severity = excluded.severity,
    title    = excluded.title,
    sub      = excluded.sub;

  return new;
end;
$$;

drop trigger if exists trg_ngs_gpa_risk on academics;

create trigger trg_ngs_gpa_risk
  after insert or update of gpa
  on academics
  for each row execute function ngs_check_gpa_risk();
