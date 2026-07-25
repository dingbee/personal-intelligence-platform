import { supabase } from '@/shared/lib/supabase'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

/**
 * Streams text deltas from the `ai-chat` edge function. Deliberately bypasses
 * `supabase.functions.invoke()`, which buffers the entire response body
 * before resolving — fine for the one-shot `embed` action, but it would
 * defeat streaming for chat. A direct `fetch` lets us read the response
 * body incrementally instead.
 */
export async function* streamAiChat(body: Record<string, unknown>): AsyncGenerator<string> {
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
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    yield decoder.decode(value, { stream: true })
  }
}

export async function invokeAiEmbed(input: string[]): Promise<number[][]> {
  const { data, error } = await supabase.functions.invoke<{ embeddings: number[][] }>('ai-chat', {
    body: { action: 'embed', input },
  })
  if (error) throw error
  return data!.embeddings
}
