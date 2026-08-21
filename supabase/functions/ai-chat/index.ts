// Supabase Edge Function (Deno). This is the ONLY place provider API keys
// are read — they're Supabase Function secrets (`supabase secrets set`),
// never a VITE_* env var, because anything VITE_-prefixed gets bundled into
// the client JS and would leak the key to every visitor.
//
// Client-side ChatProvider/EmbeddingProvider implementations
// (src/modules/ai/providers/*.ts, src/modules/ai/embeddings/*.ts) are thin
// adapters that call this function — never Anthropic/OpenAI/Google
// directly. That's the boundary the "AI execution must go through the
// registry layer, not the UI" rule described in Milestone 4 planning
// actually enforces: without a server hop, a browser-callable provider
// call always means a browser-visible key.
//
// P0-1 (Production Technical Blocker Audit) — this function used to trust
// the client for every authorization decision: who's calling, whether
// they're entitled to the requested provider, and whether they have quota
// left. Since it's reachable directly with nothing but the project's public
// anon key, that meant unlimited, unmetered, unauthenticated usage billed
// entirely to ARRIYIA's own provider keys. This function is now the actual
// enforcement boundary: it re-authenticates the caller from their own
// forwarded JWT (never trusting a client-supplied user id), resolves their
// real plan server-side, verifies the requested provider/model against that
// plan's own entitlement data (plan_ai_providers), and atomically
// reserves/consumes quota via the existing consume_quota() RPC — the exact
// same authoritative machinery src/shared/lib/quotaService.ts already used
// client-side-only before this change — before ever calling out to a real
// provider. See docs/production/... (P0-1 report) for the full design
// rationale, including why per-operation (`*_operations`) quota keys are
// honored only when the caller explicitly declares one it's entitled to,
// never inferred, and why embeddings are authenticated/plan-gated but not
// separately metered (a chat turn already triggers exactly one embed call
// internally; metering both would silently double-charge 'ai_messages').
//
// Deploy: supabase functions deploy ai-chat
// Secrets: supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GOOGLE_API_KEY=...

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ChatProviderId = 'anthropic' | 'openai' | 'google'
const CHAT_PROVIDER_IDS: ChatProviderId[] = ['anthropic', 'openai', 'google']

// Multimodal Intelligence v1 — mirrors src/modules/ai/providers/ChatProvider.ts's
// ChatContentPart exactly. Additive: every existing caller sends a plain
// string and nothing below changes for them. imageUrl is a hosted URL
// (an asset's signed URL), not inline base64, since every provider's real
// API accepts a hosted image URL directly.
type ChatContentPart = { type: 'text'; text: string } | { type: 'image'; imageUrl: string }

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | ChatContentPart[]
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.role !== 'user' && v.role !== 'assistant') return false
  if (typeof v.content === 'string') return true
  return Array.isArray(v.content) && v.content.length > 0
}

/** Anthropic Messages API content blocks: {type:'image', source:{type:'url', url}} alongside {type:'text', text}. */
function toAnthropicContent(content: string | ChatContentPart[]): unknown {
  if (typeof content === 'string') return content
  return content.map((part) =>
    part.type === 'text' ? { type: 'text', text: part.text } : { type: 'image', source: { type: 'url', url: part.imageUrl } },
  )
}

/** OpenAI Chat Completions content parts: {type:'image_url', image_url:{url}} alongside {type:'text', text}. */
function toOpenAiContent(content: string | ChatContentPart[]): unknown {
  if (typeof content === 'string') return content
  return content.map((part) => (part.type === 'text' ? { type: 'text', text: part.text } : { type: 'image_url', image_url: { url: part.imageUrl } }))
}

/**
 * Gemini generateContent parts: fileData.fileUri references a hosted URL.
 * Unverified in this deployment — GOOGLE_API_KEY is not a configured
 * secret here (see registry.ts's own comment on this), so this path has
 * never actually been exercised against the live API.
 */
function toGoogleParts(content: string | ChatContentPart[]): unknown[] {
  if (typeof content === 'string') return [{ text: content }]
  return content.map((part) => (part.type === 'text' ? { text: part.text } : { fileData: { fileUri: part.imageUrl } }))
}

interface ChatRequestBody {
  action: 'chat'
  provider: ChatProviderId
  model?: string
  system?: string
  messages: ChatMessage[]
  /**
   * P0-1 — which quota_key this call should be metered against. Omitted or
   * 'ai_messages' means ordinary chat/one-shot capability usage. Any of the
   * per-engine `*_operations` keys is honored only after independently
   * verifying (server-side, via has_feature) that the caller is actually
   * entitled to that Intelligence engine — a client can request a specific
   * key, but never fabricate the entitlement that unlocks it.
   */
  quotaKey?: string
  /** Audit-only — never used for any authorization decision. */
  workspaceId?: string | null
  feature?: string
  requestedProvider?: string
  fallbackReason?: string | null
  operationId?: string | null
  operationType?: string | null
}

interface EmbedRequestBody {
  action: 'embed'
  input: string[]
  model?: string
  /** Audit-only, same as above. */
  workspaceId?: string | null
  feature?: string
}

type RequestBody = ChatRequestBody | EmbedRequestBody

function isRequestBody(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.action === 'chat') {
    return typeof v.provider === 'string' && Array.isArray(v.messages) && v.messages.length > 0 && v.messages.every(isChatMessage)
  }
  if (v.action === 'embed') {
    return Array.isArray(v.input) && v.input.length > 0 && v.input.every((item) => typeof item === 'string')
  }
  return false
}

const DEFAULT_MODEL: Record<ChatProviderId, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.1',
  google: 'gemini-2.5-flash',
}

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

// Appended once, as the very last thing written to the normalized stream,
// so the client can separate "text the user should see" from token usage
// for Milestone 4.5's ai_requests logging. Distinctive enough that no real
// model response would ever produce it verbatim, so a plain string search
// is enough — no need for a heavier framed-message protocol.
const USAGE_MARKER = '<<<AI_USAGE_JSON>>>'

interface UsageInfo {
  model: string
  inputTokens: number | null
  outputTokens: number | null
}

// P0-1 — mirrors src/shared/lib/intelligenceOperations.ts's
// INTELLIGENCE_OPERATION_QUOTA_KEYS exactly (quota key -> the feature key
// has_feature() expects, i.e. the same string with '_operations' stripped).
// Small, deliberate duplication across the Deno/browser runtime boundary —
// same precedent send-workspace-invitation's mirrored buildInvitationEmail
// already established in this codebase, rather than a cross-runtime import.
const OPERATION_FEATURE_BY_QUOTA_KEY: Record<string, string> = {
  data_intelligence_operations: 'data_intelligence',
  analysis_intelligence_operations: 'analysis_intelligence',
  research_intelligence_operations: 'research_intelligence',
  planning_intelligence_operations: 'planning_intelligence',
  decision_intelligence_operations: 'decision_intelligence',
  action_intelligence_operations: 'action_intelligence',
}

/** Normalizes each provider's SSE wire format to a plain UTF-8 text-delta stream, tracking token usage along the way. */
function normalizeChatStream(
  provider: ChatProviderId,
  model: string,
  upstream: ReadableStream<Uint8Array>,
  onFinish: (usage: UsageInfo, errorMessage: string | null) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  const usage: UsageInfo = { model, inputTokens: null, outputTokens: null }

  function extractDelta(payload: unknown): string | null {
    if (provider === 'anthropic') {
      const event = payload as {
        type?: string
        delta?: { type?: string; text?: string; usage?: { output_tokens?: number } }
        message?: { usage?: { input_tokens?: number } }
      }
      if (event.type === 'message_start') {
        usage.inputTokens = event.message?.usage?.input_tokens ?? usage.inputTokens
      }
      if (event.type === 'message_delta') {
        usage.outputTokens = event.delta?.usage?.output_tokens ?? usage.outputTokens
      }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        return event.delta.text ?? null
      }
      return null
    }
    if (provider === 'openai') {
      const event = payload as {
        choices?: { delta?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      if (event.usage) {
        usage.inputTokens = event.usage.prompt_tokens ?? usage.inputTokens
        usage.outputTokens = event.usage.completion_tokens ?? usage.outputTokens
      }
      return event.choices?.[0]?.delta?.content ?? null
    }
    // google
    const event = payload as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
    }
    if (event.usageMetadata) {
      usage.inputTokens = event.usageMetadata.promptTokenCount ?? usage.inputTokens
      usage.outputTokens = event.usageMetadata.candidatesTokenCount ?? usage.outputTokens
    }
    return event.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  }

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice('data:'.length).trim()
            if (data === '[DONE]') continue

            try {
              const payload = JSON.parse(data)
              const text = extractDelta(payload)
              if (text) controller.enqueue(encoder.encode(text))
            } catch {
              // Ignore malformed/partial SSE payloads rather than failing the whole stream.
            }
          }
        }
        controller.enqueue(encoder.encode(`${USAGE_MARKER}${JSON.stringify(usage)}`))
        controller.close()
        onFinish(usage, null)
      } catch (err) {
        controller.error(err)
        onFinish(usage, err instanceof Error ? err.message : 'Stream error')
      }
    },
  })
}

interface RequestContext {
  callerClient: SupabaseClient
  userId: string
}

/**
 * Fire-and-forget, matching this app's existing `logAiRequest` pattern
 * (client-side, pre-this-change) — an audit-log failure must never turn a
 * real, already-served AI response into a failed request from the caller's
 * point of view. Uses the caller-scoped client (never service role): the
 * existing `ai_requests` INSERT policy is `auth.uid() = user_id`, which
 * this satisfies exactly like a client-side insert always did — no new
 * trust boundary is introduced by moving this server-side.
 */
async function recordAiRequest(
  ctx: RequestContext,
  fields: {
    workspaceId: string | null
    feature: string
    provider: string
    model: string | null
    tokensInput: number | null
    tokensOutput: number | null
    latencyMs: number
    status: 'success' | 'error'
    errorMessage: string | null
    requestedProvider: string | null
    fallbackReason: string | null
    operationId: string | null
    operationType: string | null
  },
): Promise<void> {
  const { error } = await ctx.callerClient.from('ai_requests').insert({
    user_id: ctx.userId,
    workspace_id: fields.workspaceId,
    feature: fields.feature,
    provider: fields.provider,
    model: fields.model,
    tokens_input: fields.tokensInput,
    tokens_output: fields.tokensOutput,
    latency_ms: fields.latencyMs,
    status: fields.status,
    error_message: fields.errorMessage,
    requested_provider: fields.requestedProvider,
    fallback_reason: fields.fallbackReason,
    operation_id: fields.operationId,
    operation_type: fields.operationType,
  })
  if (error) console.error('ai-chat: failed to record ai_requests audit row:', error.message)

  // #21 Phase 5 — best-effort mirror into the unified System Health centre
  // so a founder can see AI provider failures without a separate trip to
  // /admin/ai. Uses its own short-lived service-role client (never the
  // caller-scoped one ai_requests uses above) because
  // report_system_health_event is granted to service_role only — never
  // authenticated — by design (0081_system_health_events.sql). Wrapped in
  // its own try/catch and never awaited by the caller for anything: a
  // reporting failure here must never turn an already-served (or already
  // failed-and-reported-to-ai_requests) chat response into a different
  // outcome for the end user.
  if (fields.status === 'error') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceRoleKey) {
        const serviceClient = createClient(supabaseUrl, serviceRoleKey)
        await serviceClient.rpc('report_system_health_event', {
          p_severity: 'error',
          p_category: 'ai',
          p_operation: fields.feature,
          p_message: fields.errorMessage ?? 'AI provider request failed',
          p_user_id: ctx.userId,
          p_workspace_id: fields.workspaceId,
          p_provider: fields.provider,
          p_metadata: { model: fields.model, requested_provider: fields.requestedProvider, fallback_reason: fields.fallbackReason },
        })
      }
    } catch (reportErr) {
      console.error('ai-chat: failed to report system_health_event:', reportErr)
    }
  }
}

async function handleChat(body: ChatRequestBody, ctx: RequestContext): Promise<Response> {
  const model = body.model ?? DEFAULT_MODEL[body.provider]
  const start = Date.now()

  async function audit(status: 'success' | 'error', usageModel: string | null, tokensInput: number | null, tokensOutput: number | null, errorMessage: string | null) {
    await recordAiRequest(ctx, {
      workspaceId: body.workspaceId ?? null,
      feature: body.feature ?? 'chat',
      provider: body.provider,
      model: usageModel ?? model,
      tokensInput,
      tokensOutput,
      latencyMs: Date.now() - start,
      status,
      errorMessage,
      requestedProvider: body.requestedProvider ?? null,
      fallbackReason: body.fallbackReason ?? null,
      operationId: body.operationId ?? null,
      operationType: body.operationType ?? null,
    })
  }

  try {
    if (body.provider === 'anthropic') {
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (!apiKey) return errorResponse('ANTHROPIC_API_KEY is not configured', 500)

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: body.system,
          messages: body.messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
          stream: true,
        }),
      })
      if (!upstream.ok || !upstream.body) {
        const message = `Anthropic error: ${upstream.status} ${await upstream.text()}`
        await audit('error', null, null, null, message)
        return errorResponse(message, 502)
      }
      return streamResponse(normalizeChatStream('anthropic', model, upstream.body, (usage, errorMessage) => {
        void audit(errorMessage ? 'error' : 'success', usage.model, usage.inputTokens, usage.outputTokens, errorMessage)
      }))
    }

    if (body.provider === 'openai') {
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      if (!apiKey) return errorResponse('OPENAI_API_KEY is not configured', 500)

      const converted = body.messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) }))
      const messages = body.system ? [{ role: 'system', content: body.system }, ...converted] : converted
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
        }),
      })
      if (!upstream.ok || !upstream.body) {
        const message = `OpenAI error: ${upstream.status} ${await upstream.text()}`
        await audit('error', null, null, null, message)
        return errorResponse(message, 502)
      }
      return streamResponse(normalizeChatStream('openai', model, upstream.body, (usage, errorMessage) => {
        void audit(errorMessage ? 'error' : 'success', usage.model, usage.inputTokens, usage.outputTokens, errorMessage)
      }))
    }

    // google
    const apiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!apiKey) return errorResponse('GOOGLE_API_KEY is not configured', 500)

    const contents = body.messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: toGoogleParts(message.content),
    }))
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: body.system ? { parts: [{ text: body.system }] } : undefined,
        }),
      },
    )
    if (!upstream.ok || !upstream.body) {
      const message = `Google error: ${upstream.status} ${await upstream.text()}`
      await audit('error', null, null, null, message)
      return errorResponse(message, 502)
    }
    return streamResponse(normalizeChatStream('google', model, upstream.body, (usage, errorMessage) => {
      void audit(errorMessage ? 'error' : 'success', usage.model, usage.inputTokens, usage.outputTokens, errorMessage)
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error contacting the AI provider'
    await audit('error', null, null, null, message)
    return errorResponse(message, 502)
  }
}

async function handleEmbed(body: EmbedRequestBody, ctx: RequestContext): Promise<Response> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return errorResponse('OPENAI_API_KEY is not configured', 500)

  const model = body.model ?? DEFAULT_EMBEDDING_MODEL
  const start = Date.now()

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: body.input }),
    })
    if (!response.ok) {
      const message = `OpenAI embeddings error: ${response.status} ${await response.text()}`
      await recordAiRequest(ctx, {
        workspaceId: body.workspaceId ?? null,
        feature: body.feature ?? 'embed',
        provider: 'openai',
        model,
        tokensInput: null,
        tokensOutput: null,
        latencyMs: Date.now() - start,
        status: 'error',
        errorMessage: message,
        requestedProvider: null,
        fallbackReason: null,
        operationId: null,
        operationType: null,
      })
      return errorResponse(message, 502)
    }
    const json = (await response.json()) as {
      data: { embedding: number[] }[]
      usage?: { prompt_tokens?: number }
    }
    await recordAiRequest(ctx, {
      workspaceId: body.workspaceId ?? null,
      feature: body.feature ?? 'embed',
      provider: 'openai',
      model,
      tokensInput: json.usage?.prompt_tokens ?? null,
      tokensOutput: null,
      latencyMs: Date.now() - start,
      status: 'success',
      errorMessage: null,
      requestedProvider: null,
      fallbackReason: null,
      operationId: null,
      operationType: null,
    })
    return new Response(
      JSON.stringify({
        embeddings: json.data.map((d) => d.embedding),
        model,
        promptTokens: json.usage?.prompt_tokens ?? null,
      }),
      { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error contacting the embedding provider'
    await recordAiRequest(ctx, {
      workspaceId: body.workspaceId ?? null,
      feature: body.feature ?? 'embed',
      provider: 'openai',
      model,
      tokensInput: null,
      tokensOutput: null,
      latencyMs: Date.now() - start,
      status: 'error',
      errorMessage: message,
      requestedProvider: null,
      fallbackReason: null,
      operationId: null,
      operationType: null,
    })
    return errorResponse(message, 502)
  }
}

function streamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { headers: { ...CORS_HEADERS, 'content-type': 'text/plain; charset=utf-8' } })
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

/**
 * P0-1 — resolves and validates the quota_key this call should be metered
 * against. Absent or 'ai_messages' is always allowed (the universal
 * baseline every plan has). Any `*_operations` key additionally requires
 * has_feature() to confirm the caller's own resolved plan actually grants
 * that Intelligence engine — a client declaring a key it isn't entitled to
 * is rejected outright, never silently downgraded to 'ai_messages' (that
 * would let a denial look like a lesser-but-still-successful charge).
 */
async function resolveQuotaKey(callerClient: SupabaseClient, userId: string, requested: string | undefined): Promise<{ value: string } | { error: Response }> {
  if (!requested || requested === 'ai_messages') return { value: 'ai_messages' }

  const featureKey = OPERATION_FEATURE_BY_QUOTA_KEY[requested]
  if (!featureKey) return { error: errorResponse('Invalid quota key', 400) }

  const { data: entitled, error } = await callerClient.rpc('has_feature', { p_user_id: userId, p_feature_key: featureKey })
  if (error) return { error: errorResponse('Could not verify plan entitlement', 500) }
  if (!entitled) return { error: errorResponse('AI feature not available for this plan', 403) }

  return { value: requested }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return errorResponse('Supabase connection secrets are not configured', 500)

  // P0-1 — the authoritative authentication step. Never trust a
  // client-supplied user id: this is the caller's own forwarded session
  // JWT, re-verified here exactly like send-workspace-invitation/
  // delete-account already do, via a plain anon-key client (never service
  // role — nothing below needs elevated privilege, since every table this
  // function reads has RLS that already scopes to the caller's own rows,
  // and every RPC it calls is SECURITY DEFINER and resolves auth.uid()
  // from this same JWT internally).
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Authentication required', 401)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return errorResponse('Authentication required', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }
  if (!isRequestBody(body)) return errorResponse('Malformed request body', 400)

  // P0-1 — the plan/entitlement boundary. Resolved once here (not trusted
  // from the client) and reused for both the provider check below and as
  // the base "does this account have any active plan at all" gate — an
  // account with no active user_plan_assignments row can reach neither a
  // real provider nor an embedding call, regardless of what JWT it holds.
  const { data: assignment } = await callerClient
    .from('user_plan_assignments')
    .select('plan_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()
  if (!assignment) return errorResponse('AI feature not available for this plan', 403)

  const ctx: RequestContext = { callerClient, userId: user.id }

  if (body.action === 'chat') {
    if (!CHAT_PROVIDER_IDS.includes(body.provider)) return errorResponse('Unknown provider', 400)

    // P0-1 — provider entitlement, resolved from the plan just looked up
    // above against plan_ai_providers (the same table the client's own
    // resolveProviderChain already reads for UX candidacy-filtering) —
    // never the client-declared provider taken on faith.
    const { data: providerRow } = await callerClient
      .from('plan_ai_providers')
      .select('id')
      .eq('plan_id', assignment.plan_id)
      .eq('provider_id', body.provider)
      .eq('active', true)
      .maybeSingle()
    if (!providerRow) return errorResponse('Requested provider is not available for this plan', 403)

    // P0-1 — no per-model entitlement table exists anywhere in this schema
    // (plan_ai_providers is provider-level only), and no legitimate caller
    // ever actually sends a `model` override today (ChatRequest carries no
    // such field client-side). The only defensible "entitled model" this
    // system can honor without inventing a new business rule is the single
    // canonical model this function itself already designates per
    // provider — so a client-supplied model must match it exactly.
    const expectedModel = DEFAULT_MODEL[body.provider]
    if (body.model && body.model !== expectedModel) {
      return errorResponse('Requested model is not available for this plan', 403)
    }

    const quotaKey = await resolveQuotaKey(callerClient, user.id, body.quotaKey)
    if ('error' in quotaKey) return quotaKey.error

    // P0-1 — the actual enforcement: consume_quota() is a single atomic
    // upsert-increment (see 0041_user_quota_overrides.sql), so concurrent
    // requests serialize on the row lock rather than racing a
    // read-then-write. This happens BEFORE the provider is ever called —
    // a denied request never reaches Anthropic/OpenAI/Google.
    const { data: quotaResult, error: quotaError } = await callerClient.rpc('consume_quota', { p_quota_key: quotaKey.value })
    if (quotaError) return errorResponse('Could not verify AI quota', 500)
    const quotaRow = quotaResult?.[0] as { allowed?: boolean } | undefined
    if (!quotaRow?.allowed) return errorResponse('AI quota exceeded', 429)

    return await handleChat(body, ctx)
  }

  if (body.action === 'embed') {
    // Embeddings are authenticated and plan-gated (the active-plan check
    // above) but deliberately not separately metered — a single chat turn
    // already triggers exactly one embed call internally as an
    // implementation detail of retrieval; metering it too would silently
    // double-charge 'ai_messages' for one logical user action. See this
    // file's header comment.
    if (body.model && body.model !== DEFAULT_EMBEDDING_MODEL) {
      return errorResponse('Requested model is not available for this plan', 403)
    }
    return await handleEmbed(body, ctx)
  }

  return errorResponse('Unknown action', 400)
})
