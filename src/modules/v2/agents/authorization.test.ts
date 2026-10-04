import { describe, expect, it } from 'vitest'
import { evaluateAuthorizationEnvelope } from './authorization'

const base = {
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  agentId: 'agent-1',
  actionId: 'action-1',
  requestedAutonomy: 'prepare' as const,
  agentAutonomyCeiling: 'prepare' as const,
  tool: {
    id: 'tool-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    requiresApproval: true,
  },
  correlationId: 'corr-1',
}

const approved = {
  id: 'approval-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  subjectType: 'action',
  subjectId: 'action-1',
  decision: 'approved' as const,
  status: 'active' as const,
}

describe('V2-14 authorization envelope', () => {
  it('authorizes a matching approved consequential action', () => {
    const result = evaluateAuthorizationEnvelope({ ...base, approval: approved })
    expect(result.decision).toBe('authorized')
    expect(result.envelope.approvalId).toBe('approval-1')
    expect(result.envelope.contextIds).toEqual([])
    expect(result.envelope.requiresApproval).toBe(true)
  })

  it('requires approval when none is supplied', () => {
    expect(evaluateAuthorizationEnvelope(base).decision).toBe('requires_approval')
  })

  it('rejects an approval for another action', () => {
    expect(evaluateAuthorizationEnvelope({
      ...base,
      approval: { ...approved, subjectId: 'action-2' },
    })).toMatchObject({
      decision: 'denied',
      reason: 'Approval does not authorize this exact action.',
    })
  })

  it('rejects rejected, inactive, or expired approvals', () => {
    expect(evaluateAuthorizationEnvelope({
      ...base,
      approval: { ...approved, decision: 'rejected' },
    }).decision).toBe('denied')

    expect(evaluateAuthorizationEnvelope({
      ...base,
      approval: { ...approved, status: 'archived' },
    }).decision).toBe('denied')

    expect(evaluateAuthorizationEnvelope({
      ...base,
      approval: { ...approved, expiresAt: '2000-01-01T00:00:00Z' },
    }).decision).toBe('denied')
  })

  it('rejects cross-workspace approval', () => {
    expect(evaluateAuthorizationEnvelope({
      ...base,
      approval: { ...approved, workspaceId: 'ws-2' },
    }).decision).toBe('denied')
  })

  it('rejects cross-organization tools', () => {
    expect(evaluateAuthorizationEnvelope({
      ...base,
      tool: { ...base.tool, organizationId: 'org-2' },
    }).decision).toBe('denied')
  })

  it('preserves deduplicated context and provenance references', () => {
    const result = evaluateAuthorizationEnvelope({
      ...base,
      tool: { ...base.tool, requiresApproval: false },
      contextIds: ['ctx-1', 'ctx-1', 'ctx-2'],
      provenanceIds: ['src-1', 'src-1'],
      causationId: 'cause-1',
    })
    expect(result.decision).toBe('authorized')
    expect(result.envelope.contextIds).toEqual(['ctx-1', 'ctx-2'])
    expect(result.envelope.provenanceIds).toEqual(['src-1'])
    expect(result.envelope.causationId).toBe('cause-1')
  })
})
