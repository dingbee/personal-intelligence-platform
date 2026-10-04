import { describe, expect, it } from 'vitest'
import { validateToolInvocationRequest } from './adapter'
import type { ToolInvocationRequest } from './contracts'

const request: ToolInvocationRequest = {
  contractVersion: '1.0.0',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
  toolId: 'tool-1',
  input: { quantity: 1 },
  authorization: {
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    agentId: 'agent-1',
    actionId: 'action-1',
    toolId: 'tool-1',
    requestedAutonomy: 'prepare',
    agentAutonomyCeiling: 'prepare',
    decision: 'authorized',
    requiresApproval: true,
    approvalId: 'approval-1',
    contextIds: [],
    provenanceIds: [],
    correlationId: 'corr-1',
  },
}

describe('V2-14 runtime governance boundary', () => {
  it('accepts a matching authorized envelope', () => expect(() => validateToolInvocationRequest(request)).not.toThrow())
  it('rejects a non-authorized envelope', () => expect(() => validateToolInvocationRequest({ ...request, authorization: { ...request.authorization, decision: 'requires_approval' } })).toThrow('authorized governance envelope'))
  it('rejects a mismatched tool', () => expect(() => validateToolInvocationRequest({ ...request, toolId: 'tool-2' })).toThrow('tool does not match'))
  it('rejects a mismatched workspace', () => expect(() => validateToolInvocationRequest({ ...request, workspaceId: 'ws-2' })).toThrow('workspace does not match'))
  it('rejects an authorized envelope without an approval reference', () => expect(() => validateToolInvocationRequest({ ...request, authorization: { ...request.authorization, approvalId: undefined } })).toThrow('approval reference'))
  it('rejects an envelope above the agent ceiling', () => expect(() => validateToolInvocationRequest({ ...request, authorization: { ...request.authorization, requestedAutonomy: 'bounded', agentAutonomyCeiling: 'prepare' } })).toThrow('agent autonomy ceiling'))
  it('rejects a mismatched correlation', () => expect(() => validateToolInvocationRequest({ ...request, correlationId: 'corr-2' })).toThrow('correlationId does not match'))
})
