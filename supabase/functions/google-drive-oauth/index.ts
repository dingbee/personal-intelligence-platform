// Supabase Edge Function (Deno) — Import from Google Drive: OAuth
// completion. This is the ONLY place a Google refresh token is ever
// written, and it is written with the service-role key directly into
// google_drive_connections, which has zero client-facing RLS policies
// (0080_google_drive_import.sql) — the token never round-trips back to
// the browser in this function's response, matching "never expose Google
// access tokens to the frontend beyond what is required."
//
// Client flow (see src/modules/library/api/googleDrive.ts):
//   google.accounts.oauth2.initCodeClient({ ..., ux_mode: 'popup',
//     access_type: 'offline', prompt: 'consent' }) -> authorization code
//   -> POSTed here as { code } -> exchanged for tokens using redirect_uri
//   'postmessage' (Google's documented value for this exact popup-code
//   flow) -> refresh_token persisted server-side.
//
// access_type=offline + prompt=consent (set client-side) guarantee Google
// returns a refresh_token on every connect, not just the first ever
// consent — without prompt=consent, a returning user who already granted
// access once would get no refresh_token on a second connect attempt,
// which would otherwise silently break reconnect-after-disconnect.
//
// Deploy: supabase functions deploy google-drive-oauth
// Secrets required: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
// (Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0
// Client ID, type "Web application", with this app's origin(s) added
// under "Authorized JavaScript origins" — no redirect URI needs
// registering for the popup/postmessage flow used here).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } })
}

interface GoogleTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')

  // Fails closed, matching pesapal-checkout's own "not configured" 501
  // pattern — never a silent no-op that looks like success.
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !clientSecret) {
    return jsonResponse({ error: 'Google Drive import is not configured for this environment' }, 501)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const code = (body as { code?: unknown } | null)?.code
  if (typeof code !== 'string' || !code) return jsonResponse({ error: 'Missing authorization code' }, 400)

  // Authenticate the caller as themselves — never trust a client-supplied
  // user id, same pattern as every other edge function in this repo.
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    }),
  })
  const tokenBody = (await tokenRes.json().catch(() => null)) as GoogleTokenResponse | null

  if (!tokenRes.ok || !tokenBody?.access_token) {
    console.error('google-drive-oauth: token exchange failed:', tokenRes.status, JSON.stringify(tokenBody))
    return jsonResponse({ error: 'Google Drive authorization failed. Please try again.' }, 502)
  }

  if (!tokenBody.refresh_token) {
    // Should not happen with access_type=offline + prompt=consent, but if
    // Google ever omits it, we cannot persist a working connection — fail
    // honestly rather than silently storing a connection that can't
    // actually be used to import anything after the access token expires.
    return jsonResponse({ error: 'Google did not grant offline access. Please try connecting again.' }, 502)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: upsertError } = await serviceClient
    .from('google_drive_connections')
    .upsert(
      { user_id: user.id, refresh_token: tokenBody.refresh_token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (upsertError) {
    console.error('google-drive-oauth: failed to persist connection:', upsertError)
    return jsonResponse({ error: 'Failed to save your Google Drive connection' }, 500)
  }

  return jsonResponse({ connected: true }, 200)
})
