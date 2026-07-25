import { supabase } from '@/shared/lib/supabase'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

// Kept in sync with supabase/functions/ai-chat/index.ts's USAGE_MARKER.
const USAGE_MARKER = '<<<AI_USAGE_JSON>>>'

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

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session?.access_token ?? ''}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI request failed (${response.status}): ${text || response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let mode: 'text' | 'usage' = 'text'
  let usageBuffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
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

export async function invokeAiEmbed(input: string[]): Promise<EmbedResult> {
  const { data, error } = await supabase.functions.invoke<EmbedResult>('ai-chat', {
    body: { action: 'embed', input },
  })
  if (error) throw error
  return data!
}
