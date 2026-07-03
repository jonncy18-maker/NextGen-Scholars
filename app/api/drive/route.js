import { sql } from '../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Port of supabase/functions/drive-proxy/index.ts — Google Drive storage
// backend for NGS Documents. All file bytes live in Drive (mentor's account,
// NGS Documents folder); Neon stores only metadata (documents table).
//
// Actions (POST with JSON body):
//   upload     { filename, mimeType, base64, scholar_key? }  -> { fileId, filename }
//   download   { fileId }                                     -> binary file stream
//   get_base64 { fileId }                                     -> { base64, mimeType }
//   delete     { fileId }                                     -> { ok: true }
//
// Requires env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID (server-only, set in
// Vercel project env vars -- copy the same values from Supabase secrets).

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth token error: ${data.error_description ?? JSON.stringify(data)}`);
  return data.access_token;
}

async function getFileMeta(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name%2CmimeType`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return { name: data.name ?? 'file', mimeType: data.mimeType ?? 'application/octet-stream' };
}

// Safe base64 encode that handles large buffers without call-stack overflow.
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

async function assertRegistered(fileId) {
  const rows = await sql`select id from documents where storage_path = ${fileId} limit 1`;
  return rows.length > 0;
}

export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  const authHeader = request.headers.get('authorization');

  // Scholar upload path: upload only, no JWT required -- scholar_key
  // validated against the DB. Download/delete/get_base64 still require a
  // real session to prevent IDOR.
  const isScholarUpload = body.action === 'upload' && !authHeader && !!body.scholar_key;
  if (isScholarUpload) {
    const rows = await sql`select scholar_key from scholars where scholar_key = ${body.scholar_key} limit 1`;
    if (rows.length === 0) throw new AuthError(401, 'Invalid scholar key');
  } else {
    await requireScholarOwn(request);
  }

  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? '').split(/[?#]/)[0].trim();
  if (!folderId) return json({ error: 'GOOGLE_DRIVE_FOLDER_ID not configured' }, { status: 503 });

  const token = await getAccessToken();

  if (body.action === 'upload') {
    const { filename, mimeType, base64 } = body;
    if (!filename || !mimeType || !base64) return json({ error: 'Missing filename, mimeType, or base64' }, { status: 400 });

    const boundary = 'ngs_' + Date.now();
    const metaPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: filename, parents: [folderId] }) +
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const fileBytes = Buffer.from(base64, 'base64');
    const endPart = Buffer.from(`\r\n--${boundary}--`);
    const uploadBody = Buffer.concat([metaPart, fileBytes, endPart]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: uploadBody,
      }
    );
    const data = await res.json();
    if (!res.ok) return json({ error: data.error?.message ?? `Drive upload error ${res.status}` }, { status: 502 });
    return json({ fileId: data.id, filename });
  }

  if (body.action === 'download') {
    const { fileId } = body;
    if (!fileId) return json({ error: 'Missing fileId' }, { status: 400 });
    if (!(await assertRegistered(fileId))) return json({ error: 'Forbidden' }, { status: 403 });
    const [meta, fileRes] = await Promise.all([
      getFileMeta(token, fileId),
      fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (!fileRes.ok) return json({ error: `Drive download error ${fileRes.status}` }, { status: 502 });
    return new Response(fileRes.body, {
      headers: {
        'content-type': meta.mimeType,
        'content-disposition': `attachment; filename="${encodeURIComponent(meta.name)}"`,
      },
    });
  }

  if (body.action === 'get_base64') {
    const { fileId } = body;
    if (!fileId) return json({ error: 'Missing fileId' }, { status: 400 });
    if (!(await assertRegistered(fileId))) return json({ error: 'Forbidden' }, { status: 403 });
    const [meta, fileRes] = await Promise.all([
      getFileMeta(token, fileId),
      fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (!fileRes.ok) return json({ error: `Drive download error ${fileRes.status}` }, { status: 502 });
    const base64 = bufToBase64(await fileRes.arrayBuffer());
    return json({ base64, mimeType: meta.mimeType });
  }

  if (body.action === 'delete') {
    const { fileId } = body;
    if (!fileId) return json({ error: 'Missing fileId' }, { status: 400 });
    if (!(await assertRegistered(fileId))) return json({ error: 'Forbidden' }, { status: 403 });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 204 && res.status !== 404) {
      return json({ error: `Drive delete error ${res.status}` }, { status: 502 });
    }
    return json({ ok: true });
  }

  return json({ error: `Unknown action: ${body.action}` }, { status: 400 });
});
