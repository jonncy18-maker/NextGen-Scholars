// drive-proxy — Google Drive storage backend for NGS Documents
//
// All file bytes live in Google Drive (NGS Documents folder, shared with a
// dedicated service account). Supabase stores only metadata (filename,
// scholar, doc_type, status, drive file ID).
//
// Actions (POST with JSON body):
//   upload     { filename, mimeType, base64 }  → { fileId, filename }
//   download   { fileId }                       → binary file stream
//   get_base64 { fileId }                       → { base64, mimeType }   (for AI extraction)
//   delete     { fileId }                       → { ok: true }
//
// Requires Supabase secrets:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID
//
// The service account must be shared as an Editor on the NGS Documents Drive folder.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

// Server-to-server auth via a Google service account (JWT bearer grant) —
// no user consent screen, no refresh-token expiry, no test-user allowlist.
async function getAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!
  const privateKeyPem = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')!.replace(/\\n/g, '\n')

  const enc = new TextEncoder()
  const now = Math.floor(Date.now() / 1000)
  const headerB64 = base64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claimB64 = base64url(enc.encode(JSON.stringify({
    iss:   email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })))
  const signingInput = `${headerB64}.${claimB64}`

  const key = await importPrivateKey(privateKeyPem)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput))
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth token error: ${data.error_description ?? JSON.stringify(data)}`)
  return data.access_token as string
}

async function getFileMeta(token: string, fileId: string): Promise<{ name: string; mimeType: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name%2CmimeType`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  const data = await res.json()
  return { name: (data.name ?? 'file') as string, mimeType: (data.mimeType ?? 'application/octet-stream') as string }
}

// Safe base64 encode that handles large buffers without call-stack overflow
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

interface ProxyBody {
  action:      string
  filename?:   string
  mimeType?:   string
  base64?:     string
  fileId?:     string
  scholar_key?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: ProxyBody
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const authHeader = req.headers.get('Authorization')

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Scholar upload path: upload only, no JWT required — scholar_key validated against DB.
  // Download/delete/get_base64 still require full mentor JWT to prevent IDOR.
  const isScholarUpload = body.action === 'upload' && !authHeader && !!body.scholar_key
  if (isScholarUpload) {
    const { data: rows, error: skErr } = await sb
      .from('scholars')
      .select('scholar_key')
      .eq('scholar_key', body.scholar_key)
      .limit(1)
    if (skErr || !rows || rows.length === 0) return json({ error: 'Invalid scholar key' }, 401)
  } else {
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authErr } = await sb.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
  }

  // IDOR guard: read/delete actions may only touch file IDs that the app has
  // registered in the `documents` table. Without this, any authenticated caller
  // could download or delete *any* file in the mentor's Drive by guessing an ID.
  async function assertRegistered(fileId: string): Promise<boolean> {
    const { data, error } = await sb
      .from('documents')
      .select('id')
      .eq('storage_path', fileId)
      .limit(1)
    return !error && Array.isArray(data) && data.length > 0
  }

  // Strip any query params / fragments that get accidentally included when copying a Drive URL
  const folderId = (Deno.env.get('GOOGLE_DRIVE_FOLDER_ID') ?? '').split(/[?#]/)[0].trim()
  if (!folderId) return json({ error: 'GOOGLE_DRIVE_FOLDER_ID not configured' }, 503)

  try {
    const token = await getAccessToken()

    // ── upload ──────────────────────────────────────────────────────────────────
    if (body.action === 'upload') {
      const { filename, mimeType, base64 } = body
      if (!filename || !mimeType || !base64) return json({ error: 'Missing filename, mimeType, or base64' }, 400)

      const boundary = 'ngs_' + Date.now()
      const enc = new TextEncoder()
      const metaPart = enc.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify({ name: filename, parents: [folderId] }) +
        `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      )
      const fileBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      const endPart = enc.encode(`\r\n--${boundary}--`)
      const uploadBody = new Uint8Array(metaPart.length + fileBytes.length + endPart.length)
      uploadBody.set(metaPart, 0)
      uploadBody.set(fileBytes, metaPart.length)
      uploadBody.set(endPart, metaPart.length + fileBytes.length)

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: uploadBody,
        }
      )
      const data = await res.json()
      if (!res.ok) return json({ error: data.error?.message ?? `Drive upload error ${res.status}` }, 502)
      return json({ fileId: data.id, filename })
    }

    // ── download ─────────────────────────────────────────────────────────────────
    if (body.action === 'download') {
      const { fileId } = body
      if (!fileId) return json({ error: 'Missing fileId' }, 400)
      if (!await assertRegistered(fileId)) return json({ error: 'Forbidden' }, 403)
      const [meta, fileRes] = await Promise.all([
        getFileMeta(token, fileId),
        fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])
      if (!fileRes.ok) return json({ error: `Drive download error ${fileRes.status}` }, 502)
      return new Response(fileRes.body, {
        headers: {
          ...cors,
          'Content-Type': meta.mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.name)}"`,
        },
      })
    }

    // ── get_base64 (for AI extraction) ──────────────────────────────────────────
    if (body.action === 'get_base64') {
      const { fileId } = body
      if (!fileId) return json({ error: 'Missing fileId' }, 400)
      if (!await assertRegistered(fileId)) return json({ error: 'Forbidden' }, 403)
      const [meta, fileRes] = await Promise.all([
        getFileMeta(token, fileId),
        fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])
      if (!fileRes.ok) return json({ error: `Drive download error ${fileRes.status}` }, 502)
      const base64 = bufToBase64(await fileRes.arrayBuffer())
      return json({ base64, mimeType: meta.mimeType })
    }

    // ── delete ───────────────────────────────────────────────────────────────────
    if (body.action === 'delete') {
      const { fileId } = body
      if (!fileId) return json({ error: 'Missing fileId' }, 400)
      if (!await assertRegistered(fileId)) return json({ error: 'Forbidden' }, 403)
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      )
      if (!res.ok && res.status !== 204 && res.status !== 404) {
        return json({ error: `Drive delete error ${res.status}` }, 502)
      }
      return json({ ok: true })
    }

    return json({ error: `Unknown action: ${body.action}` }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
