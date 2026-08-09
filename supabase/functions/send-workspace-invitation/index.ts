// Supabase Edge Function (Deno). UX-14.5.8.3 — this app's first
// service-role-key trust boundary (flagged and deferred by the UX-14.5.8
// discovery for exactly this reason). Sends the actual invitation email
// for a `workspace_invitations` row (unknown-email path, UX-14.5.8 Phase 1)
// or a pending `workspace_members` row (known-account path, Phase 3).
//
// Trust boundary, explicitly:
//   1. The caller's own JWT (forwarded from the browser's Supabase session,
//      exactly like ai-chat/provider-availability never do today — this is
//      the first function that actually needs to know *who* is calling)
//      authenticates the request via a plain anon-key client. No JWT, no
//      auth.getUser() match -> 401. Never callable anonymously — deployed
//      with Supabase's platform-level verify_jwt ON (matching ai-chat and
//      provider-availability) as defense in depth on top of the explicit
//      auth.getUser() check below.
//   2. Authorization is re-checked here by calling the EXISTING
//      `has_workspace_role` RPC through that same caller-scoped client —
//      reusing the one authorization primitive this codebase already
//      trusts (0028_workspace_members.sql) rather than re-implementing an
//      owner check in a second place. Not an owner of the target
//      workspace -> 403.
//   3. Only once both checks pass does a SEPARATE service-role client get
//      created, and only to read the two rows RLS would otherwise block a
//      cross-user read of: the invitation/membership row itself (its own
//      table has no client-read grant for this shape of lookup-by-id
//      regardless of caller) and, for the known-account path, the
//      invitee's email from `profiles` (self-only RLS) — the exact same
//      reason `list_workspace_members` (0030) needed a security-definer
//      SQL function instead of a plain client select. The service-role key
//      itself is read from `Deno.env` (a Supabase Function secret) and
//      never appears in any response body or client-visible code path.
//   4. The invitation/membership row's own status (and, for
//      workspace_invitations, `expires_at`) is re-verified against the
//      freshly-read row, not trusted from the request body — a caller
//      cannot email an already-accepted, cancelled, or expired invitation
//      by resubmitting stale client state.
//
// Email delivery failures (missing/invalid RESEND_API_KEY, provider
// rejection) return a non-2xx response but never touch the database —
// invitation creation (invite_to_workspace, 0032) is a separate, already-
// atomic RPC call the client makes first; this function only ever reads
// rows, never writes any.
//
// Deploy: supabase functions deploy send-workspace-invitation
// Secrets: supabase secrets set RESEND_API_KEY=... [RESEND_FROM_EMAIL=...] [SITE_URL=...]
//   (SITE_URL falls back to the request's Origin header when unset, so it's
//   optional for a single-deployment-origin setup.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Mirrors src/modules/workspaces/email/buildInvitationEmail.ts exactly —
// see that file's header comment for why this is a deliberate, small
// duplication rather than a cross-runtime import.

type Eligibility = { ok: true } | { ok: false; reason: 'not_found' | 'not_pending' | 'expired' }

function checkInvitationEligibility(row: { status: string; expires_at: string } | null, now: Date): Eligibility {
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.status !== 'pending') return { ok: false, reason: 'not_pending' }
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true }
}

function checkMembershipEligibility(row: { status: string } | null): Eligibility {
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.status !== 'pending') return { ok: false, reason: 'not_pending' }
  return { ok: true }
}

function buildAcceptUrl(siteUrl: string, kind: 'invitation' | 'membership', email: string): string {
  const base = siteUrl.replace(/\/$/, '')
  if (kind === 'invitation') return `${base}/signup?email=${encodeURIComponent(email)}`
  return `${base}/settings/workspaces`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildInvitationEmail(input: {
  workspaceName: string
  inviterName: string
  role: string
  expiresAt: string | null
  acceptUrl: string
}): { subject: string; html: string; text: string } {
  const { workspaceName, inviterName, role, expiresAt, acceptUrl } = input
  const subject = `${inviterName} invited you to ${workspaceName} on ARRIYIA`
  const expiryLine = expiresAt
    ? `This invitation expires on ${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`
    : ''

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 24px;">ARRIYIA</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">You've been invited to ${escapeHtml(workspaceName)}</h1>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 8px;">
        <strong>${escapeHtml(inviterName)}</strong> invited you to join <strong>${escapeHtml(workspaceName)}</strong> as
        <strong>${escapeHtml(role)}</strong>.
      </p>
      ${expiryLine ? `<p style="font-size: 13px; color: #6b7280; margin: 0 0 24px;">${expiryLine}</p>` : '<div style="margin-bottom: 16px;"></div>'}
      <a href="${acceptUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; margin: 8px 0 24px;">
        Accept invitation
      </a>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">
        Or copy this link into your browser:<br />
        <a href="${acceptUrl}" style="color: #6b7280; word-break: break-all;">${acceptUrl}</a>
      </p>
    </div>
  `.trim()

  const text = [`${inviterName} invited you to join ${workspaceName} on ARRIYIA as ${role}.`, expiryLine, `Accept: ${acceptUrl}`]
    .filter(Boolean)
    .join('\n\n')

  return { subject, html, text }
}

interface RequestBody {
  workspaceId: string
  kind: 'invitation' | 'membership'
  id: string
}

function isRequestBody(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.workspaceId === 'string' &&
    v.workspaceId.length > 0 &&
    (v.kind === 'invitation' || v.kind === 'membership') &&
    typeof v.id === 'string' &&
    v.id.length > 0
  )
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
  if (!isRequestBody(body)) return errorResponse('workspaceId, kind, and id are required', 400)
  const { workspaceId, kind, id } = body

  // Step 1-2: authenticate + authorize as the caller, never the service role.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return errorResponse('Unauthorized', 401)

  const { data: isOwner, error: roleError } = await callerClient.rpc('has_workspace_role', {
    target_workspace_id: workspaceId,
    minimum_role: 'owner',
  })
  if (roleError) return errorResponse(roleError.message, 500)
  if (!isOwner) return errorResponse('Only a workspace owner can send invitation emails', 403)

  // Step 3: escalate to service role, strictly for the two RLS-blocked reads.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: workspace } = await serviceClient.from('workspaces').select('name').eq('id', workspaceId).maybeSingle()
  if (!workspace) return errorResponse('Workspace not found', 404)

  const { data: inviterProfile } = await callerClient.from('profiles').select('display_name, email').eq('id', user.id).maybeSingle()
  const inviterName = inviterProfile?.display_name || inviterProfile?.email || 'A workspace owner'

  let email: string
  let role: string
  let expiresAt: string | null

  if (kind === 'invitation') {
    const { data: invitation } = await serviceClient
      .from('workspace_invitations')
      .select('email, role, status, expires_at')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const eligibility = checkInvitationEligibility(invitation, new Date())
    if (!eligibility.ok) return errorResponse(`Invitation is no longer pending (${eligibility.reason})`, 409)

    email = invitation!.email
    role = invitation!.role
    expiresAt = invitation!.expires_at
  } else {
    const { data: membership } = await serviceClient
      .from('workspace_members')
      .select('user_id, role, status')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const eligibility = checkMembershipEligibility(membership)
    if (!eligibility.ok) return errorResponse(`Invitation is no longer pending (${eligibility.reason})`, 409)

    const { data: inviteeProfile } = await serviceClient.from('profiles').select('email').eq('id', membership!.user_id).maybeSingle()
    if (!inviteeProfile) return errorResponse('Invitee profile not found', 404)

    email = inviteeProfile.email
    role = membership!.role
    expiresAt = null
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? ''
  const acceptUrl = buildAcceptUrl(siteUrl, kind, email)
  const { subject, html, text } = buildInvitationEmail({ workspaceName: workspace.name, inviterName, role, expiresAt, acceptUrl })

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return errorResponse('RESEND_API_KEY is not configured', 500)
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: [email], subject, html, text }),
  })

  if (!resendResponse.ok) {
    return errorResponse(`Email provider error: ${resendResponse.status} ${await resendResponse.text()}`, 502)
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
})
