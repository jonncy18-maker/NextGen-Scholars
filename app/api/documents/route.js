import { sql } from '../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const scholar = role === 'mentor' ? searchParams.get('scholar') : scholarKey;

  const rows = scholar
    ? await sql`select * from documents where scholar = ${scholar} order by uploaded_at desc`
    : await sql`select * from documents order by uploaded_at desc`;
  return json(rows);
});

// Mirrors the insert after a successful Drive upload (both the mentor
// DocumentsSection and scholar ScholarDocuments paths use the same shape;
// storage_path is the Drive fileId, set by the client after calling drive-proxy).
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const scholar = role === 'mentor' ? body.scholar : scholarKey;
  if (role !== 'mentor' && body.scholar && body.scholar !== scholarKey) {
    throw new AuthError(403, 'Cannot upload for another scholar');
  }

  const [row] = await sql`
    insert into documents (scholar, filename, storage_path, doc_type, sem, notes, status)
    values (${scholar}, ${body.filename}, ${body.storage_path}, ${body.doc_type}, ${body.sem ?? null}, ${body.notes ?? null}, 'pending_review')
    returning *
  `;
  return json(row, { status: 201 });
});
