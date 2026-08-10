// Supabase Edge Function (Deno). Founding Pro Programme Phase 4 — sends
// the actual invitation email for a `founding_pro_invitations` row
// (0055_founding_pro_invitation_and_enrollment.sql). Mirrors
// send-beta-invitation's trust boundary and Resend integration exactly,
// adapted for founding_pro_invitations/founding_pro_applications instead
// of beta_invites.
//
// Trust boundary, explicitly (same shape as send-beta-invitation):
//   1. The caller's own JWT authenticates via a plain anon-key client.
//      No JWT, no auth.getUser() match -> 401.
//   2. Authorization is re-checked here via the EXISTING is_platform_admin()
//      RPC (0035) through that same caller-scoped client — not a platform
//      admin -> 403.
//   3. Only once both checks pass does a service-role client read the
//      founding_pro_invitations row plus the invitee's email/display name
//      from profiles (both RLS-blocked for a cross-user read otherwise) —
//      the service-role key is read from Deno.env and never appears in
//      any response body.
//   4. The invitation's own `status` is re-verified against the freshly-
//      read row, not trusted from the request body — a caller cannot
//      re-email an already-accepted invitation by resubmitting stale
//      state.
//
// This function only ever reads founding_pro_invitations, never writes
// it — invitation creation (admin_invite_founding_pro_member) remains
// the only mutator, and a delivery failure here never touches the
// database: the invitation row's status is untouched either way, so
// "invitation created" and "email delivered" stay two distinct,
// honestly-reported facts (same discipline send-beta-invitation already
// established for beta_invites).
//
// Never invents or hard-codes a price: founding_price_cents/currency
// come straight from the invitation row, which the admin supplied at
// invite time (admin_invite_founding_pro_member) and which is never
// mutated afterward.
//
// Deploy: supabase functions deploy send-founding-pro-invitation
// Secrets: reuses RESEND_API_KEY / RESEND_FROM_EMAIL / SITE_URL, already
//   configured for send-beta-invitation / send-workspace-invitation — no
//   new secret to set up.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency })
}

function buildFoundingProInvitationEmail(input: {
  fullName: string | null
  priceLabel: string
  acceptUrl: string
}): { subject: string; html: string; text: string } {
  const { fullName, priceLabel, acceptUrl } = input
  const greeting = fullName ? `Hi ${escapeHtml(fullName)},` : 'Hi,'
  const subject = "You're invited to ARRIYIA Founding Pro"

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 24px;">ARRIYIA Founding Pro</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">Your Founding Pro invitation is ready</h1>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 8px;">${greeting}</p>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px;">
        Your Founding Pro application has been approved. You're invited to activate full Pro functionality at your
        founding rate of <strong>${escapeHtml(priceLabel)}</strong> for your founding period.
      </p>
      <a href="${acceptUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; margin: 8px 0 24px;">
        Accept your Founding Pro invitation
      </a>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">
        Or copy this link into your browser:<br />
        <a href="${acceptUrl}" style="color: #6b7280; word-break: break-all;">${acceptUrl}</a>
      </p>
    </div>
  `.trim()

  const text = [
    `${greeting}`,
    `Your Founding Pro application has been approved. Activate full Pro functionality at your founding rate of ${priceLabel} for your founding period:`,
    acceptUrl,
  ].join('\n\n')

  return { subject, html, text }
}

interface RequestBody {
  invitationId: string
}

function isRequestBody(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.invitationId === 'string' && v.invitationId.length > 0
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
  if (!isRequestBody(body)) return errorResponse('invitationId is required', 400)
  const { invitationId } = body

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
  if (!isAdmin) return errorResponse('Only a platform admin can send Founding Pro invitation emails', 403)

  // Step 3: escalate to service role, strictly for the RLS-blocked reads.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: invitation } = await serviceClient
    .from('founding_pro_invitations')
    .select('user_id, status, founding_price_cents, currency')
    .eq('id', invitationId)
    .maybeSingle()

  if (!invitation) return errorResponse('Invitation not found', 404)
  if (invitation.status !== 'pending') return errorResponse(`Invitation is no longer pending (${invitation.status})`, 409)

  const { data: profile } = await serviceClient.from('profiles').select('email, display_name').eq('id', invitation.user_id).maybeSingle()
  if (!profile) return errorResponse('Invitee profile not found', 404)

  const siteUrl = (Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? '').replace(/\/$/, '')
  const acceptUrl = `${siteUrl}/founding-pro/invitation`
  const priceLabel = formatPrice(invitation.founding_price_cents, invitation.currency)
  const { subject, html, text } = buildFoundingProInvitationEmail({ fullName: profile.display_name, priceLabel, acceptUrl })

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return errorResponse('RESEND_API_KEY is not configured', 500)
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: [profile.email], subject, html, text }),
  })

  if (!resendResponse.ok) {
    const resendBody = await resendResponse.text()
    console.error(`send-founding-pro-invitation: Resend rejected the send for invitation ${invitationId} (${resendResponse.status})`)
    return errorResponse(`Email provider error: ${resendResponse.status} ${resendBody}`, 502)
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
})
