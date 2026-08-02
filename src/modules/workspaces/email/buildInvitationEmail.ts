/**
 * UX-14.5.8.3 — pure, framework-agnostic logic for the
 * `send-workspace-invitation` edge function's decisions and email content.
 * Deliberately kept dependency-free (no Supabase client, no Deno API) so it
 * can be exercised under `vitest run`, which is this repo's actual
 * verification gate — the edge function itself runs on Deno, which this
 * repo has no test runner for (confirmed: `ai-chat`/`provider-availability`
 * have zero test coverage of their own Deno glue). `supabase/functions/
 * send-workspace-invitation/index.ts` mirrors this same logic inline
 * (small enough that duplicating it matches this codebase's existing
 * precedent of fully self-contained edge functions, rather than reaching
 * for a cross-runtime import) — any change here must be mirrored there.
 */

export type InvitationEligibility =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'expired' }

/** Decides whether an `workspace_invitations` row (the "unknown email" path) is still safe to email. */
export function checkInvitationEligibility(
  row: { status: string; expires_at: string } | null,
  now: Date,
): InvitationEligibility {
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.status !== 'pending') return { ok: false, reason: 'not_pending' }
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true }
}

/** Decides whether a `workspace_members` pending row (the "known account" path) is still safe to email. No expiry concept exists for this table. */
export function checkMembershipEligibility(row: { status: string } | null): InvitationEligibility {
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.status !== 'pending') return { ok: false, reason: 'not_pending' }
  return { ok: true }
}

/**
 * The "unknown email" path has no account yet, so the accept action is
 * "sign up" — prefilling the invited address saves a retype and avoids a
 * typo creating an account the invitation can never reconcile against.
 * The "known account" path already has a working accept/decline UI
 * (`WorkspaceManagementPage`'s Pending Invitations section, Phase 3) — the
 * email just needs to land the recipient there (behind the existing login
 * gate if they aren't already signed in).
 */
export function buildAcceptUrl(siteUrl: string, kind: 'invitation' | 'membership', email: string): string {
  const base = siteUrl.replace(/\/$/, '')
  if (kind === 'invitation') return `${base}/signup?email=${encodeURIComponent(email)}`
  return `${base}/settings/workspaces`
}

export interface InvitationEmailInput {
  workspaceName: string
  inviterName: string
  role: string
  /** null for the "known account" path — workspace_members has no expiry concept. */
  expiresAt: string | null
  acceptUrl: string
}

export interface InvitationEmailContent {
  subject: string
  html: string
  text: string
}

function formatExpiryDate(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Simple, single-file HTML template — no MJML/react-email dependency, matching "keep the template simple." */
export function buildInvitationEmail(input: InvitationEmailInput): InvitationEmailContent {
  const { workspaceName, inviterName, role, expiresAt, acceptUrl } = input
  const subject = `${inviterName} invited you to ${workspaceName} on NOVA`
  const expiryLine = expiresAt ? `This invitation expires on ${formatExpiryDate(expiresAt)}.` : ''

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 24px;">NOVA</p>
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

  const text = [
    `${inviterName} invited you to join ${workspaceName} on NOVA as ${role}.`,
    expiryLine,
    `Accept: ${acceptUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { subject, html, text }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
