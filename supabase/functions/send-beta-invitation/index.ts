// Supabase Edge Function (Deno). PIP Stabilization v1 (P1) — beta invite
// creation (admin_create_beta_invite, 0035_platform_admin_foundation.sql)
// has always stopped at a database row; nothing ever sent the invitee an
// email. This closes that gap by mirroring send-workspace-invitation's
// already-working trust boundary and Resend integration exactly, adapted
// for beta_invites instead of workspace_invitations/workspace_members.
//
// Trust boundary, explicitly (same shape as send-workspace-invitation):
//   1. The caller's own JWT authenticates via a plain anon-key client.
//      No JWT, no auth.getUser() match -> 401.
//   2. Authorization is re-checked here via the EXISTING is_platform_admin()
//      RPC (0035) through that same caller-scoped client — not a founder ->
//      403. This is the one function-level authorization primitive this
//      codebase already trusts for admin actions.
//   3. Only once both checks pass does a service-role client read the
//      beta_invites row (its own table has no client-read grant for this
//      shape of lookup-by-id) — the service-role key is read from
//      Deno.env and never appears in any response body.
//   4. The invite's own `status` is re-verified against the freshly-read
//      row, not trusted from the request body — a caller cannot re-email
//      an already-accepted or revoked invite by resubmitting stale state.
//
// This function only ever reads beta_invites, never writes it — invite
// creation/revocation (admin_create_beta_invite/admin_revoke_beta_invite)
// remain the only mutators, and a delivery failure here never touches the
// database: the invite row's status is untouched either way, so "invite
// created" and "email delivered" stay two distinct, honestly-reported facts.
//
// Deploy: supabase functions deploy send-beta-invitation
// Secrets: reuses RESEND_API_KEY / RESEND_FROM_EMAIL / SITE_URL, already
//   configured for send-workspace-invitation — no new secret to set up.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildBetaInvitationEmail(input: { fullName: string | null; acceptUrl: string }): { subject: string; html: string; text: string } {
  const { fullName, acceptUrl } = input
  const greeting = fullName ? `Hi ${escapeHtml(fullName)},` : 'Hi,'
  const subject = "You're invited to the ARRIYIA beta"

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 24px;">ARRIYIA</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">You've been invited to the ARRIYIA beta</h1>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 8px;">${greeting}</p>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
        You've been invited to join the ARRIYIA beta — a personal knowledge intelligence workspace. Use the button below to
        create your account with this email address.
      </p>
      <a href="${acceptUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; margin: 8px 0 24px;">
        Create your account
      </a>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">
        Or copy this link into your browser:<br />
        <a href="${acceptUrl}" style="color: #6b7280; word-break: break-all;">${acceptUrl}</a>
      </p>
    </div>
  `.trim()

  const text = [
    `${greeting}`,
    "You've been invited to the ARRIYIA beta. Create your account with this email address:",
    acceptUrl,
  ].join('\n\n')

  return { subject, html, text }
}

interface RequestBody {
  inviteId: string
}

function isRequestBody(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.inviteId === 'string' && v.inviteId.length > 0
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse('Supabase connection secrets are not configured', 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Unauthorized', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }
  if (!isRequestBody(body)) return errorResponse('inviteId is required', 400)
  const { inviteId } = body

  // Step 1-2: authenticate + authorize as the caller, never the service role.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return errorResponse('Unauthorized', 401)

  const { data: isAdmin, error: adminError } = await callerClient.rpc('is_platform_admin')
  if (adminError) return errorResponse(adminError.message, 500)
  if (!isAdmin) return errorResponse('Only a platform admin can send beta invitation emails', 403)

  // Step 3: escalate to service role, strictly for the one RLS-blocked read.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: invite } = await serviceClient
    .from('beta_invites')
    .select('email, full_name, status')
    .eq('id', inviteId)
    .maybeSingle()

  if (!invite) return errorResponse('Invite not found', 404)
  if (invite.status !== 'invited') return errorResponse(`Invite is no longer pending (${invite.status})`, 409)

  const siteUrl = (Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? '').replace(/\/$/, '')
  const acceptUrl = `${siteUrl}/signup?email=${encodeURIComponent(invite.email)}`
  const { subject, html, text } = buildBetaInvitationEmail({ fullName: invite.full_name, acceptUrl })

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return errorResponse('RESEND_API_KEY is not configured', 500)
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: [invite.email], subject, html, text }),
  })

  if (!resendResponse.ok) {
    const resendBody = await resendResponse.text()
    // Post-10/10 Phase 5.1 (Auth & Transactional Email Reliability) — this was
    // previously only ever visible in the HTTP response to the caller, with
    // no server-side trail for later diagnosis if the frontend caller's own
    // error handling didn't surface it. inviteId is safe to log (not a
    // secret); the Resend response body/key never is, and isn't logged here.
    console.error(`send-beta-invitation: Resend rejected the send for invite ${inviteId} (${resendResponse.status})`)
    return errorResponse(`Email provider error: ${resendResponse.status} ${resendBody}`, 502)
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
})
