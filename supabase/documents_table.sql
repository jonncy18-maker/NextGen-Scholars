-- NextGen Scholars — Step 13: Documents tracker
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new

-- ── DOCUMENTS TABLE ────────────────────────────────────────────────────────────

create table if not exists documents (
  id                 uuid        default gen_random_uuid() primary key,
  scholar            text        references scholars(scholar_key) on delete cascade,
  filename           text        not null,
  storage_path       text        not null,
  doc_type           text        not null default 'other'
                                   check (doc_type in ('receipt','transcript','visa','oet','other')),
  status             text        not null default 'pending_review'
                                   check (status in ('pending_review','reviewed','linked')),
  linked_expense_id  text,
  sem                text,
  notes              text,
  uploaded_at        timestamptz default now()
);

alter table documents enable row level security;

-- Mentor: full access
create policy "auth_all_documents" on documents
  for all to authenticated using (true) with check (true);

-- Scholars (anon): can insert and read their own documents
create policy "anon_insert_documents" on documents
  for insert to anon with check (true);

create policy "anon_read_documents" on documents
  for select to anon using (true);

-- ── STORAGE BUCKET ─────────────────────────────────────────────────────────────
-- Create the 'documents' bucket manually in the Supabase Storage dashboard:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/storage/buckets
--
-- Settings:
--   Name: documents
--   Public: false  (signed URLs used for downloads)
--
-- Then add these storage policies via the dashboard or run:

-- Allow authenticated users to upload and manage all files
-- (set via Supabase dashboard Storage > documents > Policies)
--
-- Policy: "auth_all_storage"   — for authenticated, all operations
-- Policy: "anon_insert_storage" — for anon, INSERT only (scholar uploads)
-- Policy: "anon_read_storage"   — for anon, SELECT only (scholar downloads their own)
