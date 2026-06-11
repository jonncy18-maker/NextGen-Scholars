// Orchestrator entry point for the NGS AI Intelligence Layer.
//
// Routing rules (evaluated in order):
//   type=ingest + file present  → Tier 3 (Claude — multimodal extraction)
//   type=ingest + text          → Tier 3 (Claude — structured text parsing)
//   type=query                  → Tier 1 (DB resolver), escalates to Tier 2 (Gemini) if needed
//
// Tiers 1, 2, and 3 are wired in P1. This shell establishes the interface
// and validates the request shape so frontend integration can begin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tier1Resolve } from './tier1.ts'
import { buildContext } from './context.ts'

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

interface AskBody {
  scholar: string
  type:    'query' | 'ingest'
  text?:   string
  file?:   { base64: string; mime: string }
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
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  let body: AskBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { scholar, type, text, file } = body
  if (!scholar) return json({ error: 'Missing required field: scholar' }, 400)
  if (type !== 'query' && type !== 'ingest') {
    return json({ error: 'Field "type" must be "query" or "ingest"' }, 400)
  }

  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest request requires file or text' }, 400)
    // Tier 3 (Claude) — wired in P1
    return json({ tier: 3, status: 'not_implemented' }, 501)
  }

  // type === 'query'
  if (!text?.trim()) return json({ error: 'Query request requires text' }, 400)

  // Tier 1 — DB resolver
  try {
    const result = await tier1Resolve(text, scholar, sb)
    if (result.answered) {
      return json({ tier: 1, ...result })
    }
    // Tier 1 couldn't answer — build context bundle and escalate to Tier 2 (Gemini)
    // The context is returned now so the frontend can inspect it; Gemini is wired in Step 6.
    const ctx = await buildContext(scholar, sb)
    return json({ tier: 2, status: 'not_implemented', context: ctx, hint: 'Gemini escalation pending (Step 6).' }, 501)
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Tier 1 query failed' }, 500)
  }
})
