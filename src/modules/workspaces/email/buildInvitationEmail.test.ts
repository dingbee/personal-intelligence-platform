import { describe, expect, it } from 'vitest'
import {
  buildAcceptUrl,
  buildInvitationEmail,
  checkInvitationEligibility,
  checkMembershipEligibility,
} from '@/modules/workspaces/email/buildInvitationEmail'

describe('checkInvitationEligibility', () => {
  const now = new Date('2026-01-15T00:00:00.000Z')

  it('is eligible for a pending, unexpired invitation', () => {
    expect(checkInvitationEligibility({ status: 'pending', expires_at: '2026-02-01T00:00:00.000Z' }, now)).toEqual({
      ok: true,
    })
  })

  it('rejects a missing row (not found)', () => {
    expect(checkInvitationEligibility(null, now)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('rejects an already-accepted invitation', () => {
    expect(checkInvitationEligibility({ status: 'accepted', expires_at: '2026-02-01T00:00:00.000Z' }, now)).toEqual({
      ok: false,
      reason: 'not_pending',
    })
  })

  it('rejects a cancelled invitation', () => {
    expect(checkInvitationEligibility({ status: 'cancelled', expires_at: '2026-02-01T00:00:00.000Z' }, now)).toEqual({
      ok: false,
      reason: 'not_pending',
    })
  })

  it('rejects an expired invitation', () => {
    expect(checkInvitationEligibility({ status: 'pending', expires_at: '2026-01-01T00:00:00.000Z' }, now)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })
})

describe('checkMembershipEligibility', () => {
  it('is eligible for a pending membership', () => {
    expect(checkMembershipEligibility({ status: 'pending' })).toEqual({ ok: true })
  })

  it('rejects a missing row (not found)', () => {
    expect(checkMembershipEligibility(null)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('rejects an already-active membership', () => {
    expect(checkMembershipEligibility({ status: 'active' })).toEqual({ ok: false, reason: 'not_pending' })
  })

  it('rejects a removed membership', () => {
    expect(checkMembershipEligibility({ status: 'removed' })).toEqual({ ok: false, reason: 'not_pending' })
  })
})

describe('buildAcceptUrl', () => {
  it('builds a signup link with the invited email prefilled for the invitation path', () => {
    expect(buildAcceptUrl('https://app.example.com', 'invitation', 'teammate@example.com')).toBe(
      'https://app.example.com/signup?email=teammate%40example.com',
    )
  })

  it('builds a link to the pending-invitations UI for the membership path', () => {
    expect(buildAcceptUrl('https://app.example.com', 'membership', 'teammate@example.com')).toBe(
      'https://app.example.com/settings/workspaces',
    )
  })

  it('strips a trailing slash from the site URL', () => {
    expect(buildAcceptUrl('https://app.example.com/', 'membership', 'teammate@example.com')).toBe(
      'https://app.example.com/settings/workspaces',
    )
  })
})

describe('buildInvitationEmail', () => {
  it('includes workspace name, inviter, role, and accept link', () => {
    const email = buildInvitationEmail({
      workspaceName: 'Research Notes',
      inviterName: 'Ada Lovelace',
      role: 'editor',
      expiresAt: '2026-02-14T00:00:00.000Z',
      acceptUrl: 'https://app.example.com/signup?email=x%40y.com',
    })

    expect(email.subject).toBe('Ada Lovelace invited you to Research Notes on ARRIYIA')
    expect(email.html).toContain('Research Notes')
    expect(email.html).toContain('Ada Lovelace')
    expect(email.html).toContain('editor')
    expect(email.html).toContain('https://app.example.com/signup?email=x%40y.com')
    expect(email.html).toContain('February 14, 2026')
    expect(email.text).toContain('Accept: https://app.example.com/signup?email=x%40y.com')
  })

  it('omits the expiration line when expiresAt is null (the known-account path)', () => {
    const email = buildInvitationEmail({
      workspaceName: 'Research Notes',
      inviterName: 'Ada Lovelace',
      role: 'viewer',
      expiresAt: null,
      acceptUrl: 'https://app.example.com/settings/workspaces',
    })

    expect(email.html).not.toContain('expires on')
    expect(email.text).not.toContain('expires on')
  })

  it('escapes HTML-significant characters in workspace name, inviter name, and role', () => {
    const email = buildInvitationEmail({
      workspaceName: '<script>alert(1)</script>',
      inviterName: 'Bob & "Alice"',
      role: 'editor',
      expiresAt: null,
      acceptUrl: 'https://app.example.com/settings/workspaces',
    })

    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).toContain('Bob &amp; &quot;Alice&quot;')
  })
})
