// Supabase Edge Function (Deno). Reports which chat providers have a
// configured API key secret — booleans only, NEVER the key values
// themselves. Deliberately a separate function from ai-chat: this task
// must not modify ai-chat, and existence-checking is a much simpler,
// distinct concern from actually invoking a provider — no upstream call,
// no streaming, just Deno.env.get() presence checks against the exact
// same secret names ai-chat itself reads.
//
// Deploy: supabase functions deploy provider-availability

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface ProviderAvailability {
  anthropic: boolean
  openai: boolean
  google: boolean
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const availability: ProviderAvailability = {
    anthropic: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
    openai: Boolean(Deno.env.get('OPENAI_API_KEY')),
    // Accept either secret name — ai-chat itself only reads GOOGLE_API_KEY,
    // but GEMINI_API_KEY is checked too in case it's ever set under that
    // name instead.
    google: Boolean(Deno.env.get('GOOGLE_API_KEY') ?? Deno.env.get('GEMINI_API_KEY')),
  }

  return new Response(JSON.stringify(availability), {
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
})
