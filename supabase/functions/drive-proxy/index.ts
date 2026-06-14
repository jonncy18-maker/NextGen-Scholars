// drive-proxy — Google Drive storage backend for NGS Documents
//
// All file bytes live in Google Drive (mentor's account, NGS Documents folder).
// Supabase stores only metadata (filename, scholar, doc_type, status, drive file ID).
//
// Actions (POST with JSON body):
//   upload     { filename, mimeType, base64 }  → { fileId, filename }
//   download   { fileId }                       → binary file stream
//   get_base64 { fileId }                       → { base64, mimeType }   (for AI extraction)
//   delete     { fileId }                       → { ok: true }
//
// Requires Supabase secrets:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID

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

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_DRIVE_REFRESH_TOKEN')!,
      grant_type:    'refresh_token',
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
  action:    string
  filename?: string
  mimeType?: string
  base64?:   string
  fileId?:   string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  let body: ProxyBody
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

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
