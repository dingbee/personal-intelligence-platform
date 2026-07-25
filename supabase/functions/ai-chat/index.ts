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
// Deploy: supabase functions deploy ai-chat
// Secrets: supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GOOGLE_API_KEY=...

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ChatProviderId = 'anthropic' | 'openai' | 'google'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  action: 'chat'
  provider: ChatProviderId
  model?: string
  system?: string
  messages: ChatMessage[]
}

interface EmbedRequestBody {
  action: 'embed'
  input: string[]
  model?: string
}

type RequestBody = ChatRequestBody | EmbedRequestBody

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

/** Normalizes each provider's SSE wire format to a plain UTF-8 text-delta stream, tracking token usage along the way. */
function normalizeChatStream(
  provider: ChatProviderId,
  model: string,
  upstream: ReadableStream<Uint8Array>,
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
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

async function handleChat(body: ChatRequestBody): Promise<Response> {
  const model = body.model ?? DEFAULT_MODEL[body.provider]

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
        messages: body.messages,
        stream: true,
      }),
    })
    if (!upstream.ok || !upstream.body) {
      return errorResponse(`Anthropic error: ${upstream.status} ${await upstream.text()}`, 502)
    }
    return streamResponse(normalizeChatStream('anthropic', model, upstream.body))
  }

  if (body.provider === 'openai') {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return errorResponse('OPENAI_API_KEY is not configured', 500)

    const messages = body.system ? [{ role: 'system', content: body.system }, ...body.messages] : body.messages
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
      return errorResponse(`OpenAI error: ${upstream.status} ${await upstream.text()}`, 502)
    }
    return streamResponse(normalizeChatStream('openai', model, upstream.body))
  }

  // google
  const apiKey = Deno.env.get('GOOGLE_API_KEY')
  if (!apiKey) return errorResponse('GOOGLE_API_KEY is not configured', 500)

  const contents = body.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
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
    return errorResponse(`Google error: ${upstream.status} ${await upstream.text()}`, 502)
  }
  return streamResponse(normalizeChatStream('google', model, upstream.body))
}

async function handleEmbed(body: EmbedRequestBody): Promise<Response> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return errorResponse('OPENAI_API_KEY is not configured', 500)

  const model = body.model ?? DEFAULT_EMBEDDING_MODEL
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: body.input }),
  })
  if (!response.ok) {
    return errorResponse(`OpenAI embeddings error: ${response.status} ${await response.text()}`, 502)
  }
  const json = (await response.json()) as {
    data: { embedding: number[] }[]
    usage?: { prompt_tokens?: number }
  }
  return new Response(
    JSON.stringify({
      embeddings: json.data.map((d) => d.embedding),
      model,
      promptTokens: json.usage?.prompt_tokens ?? null,
    }),
    { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
  )
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const body = (await req.json()) as RequestBody
    if (body.action === 'chat') return await handleChat(body)
    if (body.action === 'embed') return await handleEmbed(body)
    return errorResponse('Unknown action', 400)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Unexpected error', 500)
  }
})
