import { describe, expect, it } from 'vitest'
import type { Approval, Tool } from '../domain/model'
import { evaluateActionAuthorization, evaluateAutonomy } from './bounded-autonomy'

const consequentialTool: Tool = {
  id: 'tool-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  name: 'Purchase Order',
  inputSchema: {},
  capability: 'purchasing',
  requiredPermissions: ['purchasing.write'],
  requiresApproval: true,
  status: 'active',
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
}

const approved: Approval = {
  id: 'approval-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  subjectType: 'action',
  subjectId: 'action-1',
  requestedBy: 'user-1',
  decision: 'approved',
  decidedBy: 'user-1',
  decidedAt: '2026-10-04T01:00:00Z',
  status: 'active',
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T01:00:00Z',
}

describe('V2-13 bounded autonomy', () => {
  it('allows a request at or below the agent ceiling', () => {
    expect(evaluateAutonomy('prepare', 'bounded')).toMatchObject({
      allowed: true,
      requested: 'prepare',
      ceiling: 'bounded',
    })
  })

  it('rejects a request above the agent ceiling', () => {
    expect(evaluateAutonomy('bounded', 'prepare')).toMatchObject({
      allowed: false,
      reason: 'Requested autonomy exceeds the agent autonomy ceiling.',
    })
  })

  it('rejects a request above the applicable policy maximum', () => {
    expect(evaluateActionAuthorization({
      requestedAutonomy: 'prepare',
      agentAutonomyCeiling: 'bounded',
      policyMaximumAutonomy: 'recommend',
      tool: { requiresApproval: false },
    })).toMatchObject({
      allowed: false,
      reason: 'Requested autonomy exceeds the applicable policy maximum autonomy.',
    })
  })

  it('fails closed for consequential actions without approval', () => {
    expect(evaluateActionAuthorization({
      requestedAutonomy: 'prepare',
      agentAutonomyCeiling: 'prepare',
      tool: consequentialTool,
    })).toMatchObject({
      allowed: false,
      requiresApproval: true,
      reason: 'Consequential action requires an approved governance decision before execution.',
    })
  })

  it('accepts a consequential action only with an approved governance decision', () => {
    expect(evaluateActionAuthorization({
      requestedAutonomy: 'prepare',
      agentAutonomyCeiling: 'prepare',
      tool: consequentialTool,
      approval: approved,
    })).toEqual({
      allowed: true,
      requiresApproval: false,
    })
  })

  it('does not infer consequence from a tool name', () => {
    expect(evaluateActionAuthorization({
      requestedAutonomy: 'prepare',
      agentAutonomyCeiling: 'prepare',
      tool: {
        requiresApproval: false,
      },
    })).toEqual({
      allowed: true,
      requiresApproval: false,
    })
  })
})
