import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

// Kept in sync with supabase/functions/ai-chat/index.ts's USAGE_MARKER.
const USAGE_MARKER = '<<<AI_USAGE_JSON>>>'

// No data at all (not even the initial response, and not a single stream
// chunk) for this long counts as hung. This is an idle timeout, not a flat
// deadline — it resets on every chunk received, so a slow-but-actively-
// streaming answer is never cut off, only a connection that's genuinely
// stalled. Exported so normalizeAiError can recognize the resulting error
// by message and categorize it as a timeout, without duplicating the text.
export const AI_REQUEST_IDLE_TIMEOUT_MS = 30_000
export const AI_REQUEST_TIMEOUT_MESSAGE = `AI request timed out after ${AI_REQUEST_IDLE_TIMEOUT_MS / 1000}s of inactivity`

export interface ChatUsage {
  model: string
  inputTokens: number | null
  outputTokens: number | null
}

/**
 * Streams text deltas from the `ai-chat` edge function. Deliberately bypasses
 * `supabase.functions.invoke()`, which buffers the entire response body
 * before resolving — fine for the one-shot `embed` action, but it would
 * defeat streaming for chat. A direct `fetch` lets us read the response
 * body incrementally instead.
 *
 * The edge function appends a usage marker as the very last thing it
 * writes; once seen, everything after it is usage JSON, not visible text.
 */
export async function* streamAiChat(
  body: Record<string, unknown>,
  onUsage?: (usage: ChatUsage) => void,
): AsyncGenerator<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const controller = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  function resetIdleTimer() {
    if (idleTimer !== undefined) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), AI_REQUEST_IDLE_TIMEOUT_MS)
  }
  resetIdleTimer()

  let response: Response
  try {
    response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.access_token ?? ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(idleTimer)
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error(AI_REQUEST_TIMEOUT_MESSAGE)
    throw err
  }

  if (!response.ok) {
    clearTimeout(idleTimer)
    const text = await response.text().catch(() => '')
    throw new Error(`AI request failed (${response.status}): ${text || response.statusText}`)
  }
  if (!response.body) {
    clearTimeout(idleTimer)
    throw new Error('AI response had no body (invalid response)')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let mode: 'text' | 'usage' = 'text'
  let usageBuffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      resetIdleTimer()
      const chunk = decoder.decode(value, { stream: true })

      if (mode === 'text') {
        const markerIndex = chunk.indexOf(USAGE_MARKER)
        if (markerIndex === -1) {
          yield chunk
        } else {
          if (markerIndex > 0) yield chunk.slice(0, markerIndex)
          mode = 'usage'
          usageBuffer = chunk.slice(markerIndex + USAGE_MARKER.length)
        }
      } else {
        usageBuffer += chunk
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error(AI_REQUEST_TIMEOUT_MESSAGE)
    throw err
  } finally {
    clearTimeout(idleTimer)
  }

  if (mode === 'usage' && onUsage) {
    try {
      onUsage(JSON.parse(usageBuffer) as ChatUsage)
    } catch {
      // Usage is observability, not correctness — a malformed/truncated
      // marker just means this one request goes unlogged for tokens.
    }
  }
}

export interface EmbedResult {
  embeddings: number[][]
  model: string
  promptTokens: number | null
}

/**
 * P1-3 (Edge Function diagnostic error-swallowing) — mirrors workspaceMembers.ts's
 * own `extractEdgeFunctionErrorMessage` exactly (same `.error` field convention
 * ai-chat's own `errorResponse` helper always uses, same fail-open-to-the-
 * generic-message behavior on a non-JSON or unexpected body), adapted for
 * `invokeAiEmbed`'s throw-based contract: rather than returning a string,
 * this mutates the SAME `FunctionsHttpError` instance's own `.message` in
 * place and rethrows it completely unchanged in every other respect (still
 * a `FunctionsHttpError`, `.context` untouched as an object reference).
 *
 * That matters specifically here because `processDocument.ts`'s
 * `isRateLimitError()` also needs to read this same 429 signal from the
 * same error object further downstream (`embedBatchWithRetry`'s catch,
 * after `OpenAIEmbeddingProvider.embed()`'s own catch has already run) —
 * and a fetch `Response` body (`.context`) can only ever be read once.
 * Mutating `.message` in place here, then having `isRateLimitError` read
 * `.message` instead of re-reading `.context`, is what lets both the
 * observability fix (this function, `OpenAIEmbeddingProvider`) and the
 * retry logic (`processDocument.ts`) see the real diagnostic text from a
 * single body read, without changing the error's type or breaking either
 * one.
 */
async function extractEdgeFunctionErrorMessage(error: FunctionsHttpError): Promise<void> {
  try {
    const body: unknown = await error.context.json()
    if (body && typeof body === 'object' && 'error' in body) {
      const serverMessage = (body as { error: unknown }).error
      if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) {
        error.message = serverMessage
      }
    }
  } catch {
    // Response body wasn't valid JSON (or couldn't be read) — the original generic message is left as-is.
  }
}

export async function invokeAiEmbed(input: string[]): Promise<EmbedResult> {
  const { data, error } = await supabase.functions.invoke<EmbedResult>('ai-chat', {
    body: { action: 'embed', input },
  })
  if (error) {
    if (error instanceof FunctionsHttpError) await extractEdgeFunctionErrorMessage(error)
    throw error
  }
  return data!
}
