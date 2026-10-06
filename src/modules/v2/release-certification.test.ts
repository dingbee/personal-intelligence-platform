import { describe, expect, it } from 'vitest'
import { evaluateAuthorizationEnvelope } from './agents/authorization'
import { validateToolInvocationRequest } from './runtime/adapter'
import type { ToolInvocationRequest } from './runtime/contracts'
import { autonomyAtMost, AUTONOMY_LEVELS } from './domain/autonomy'
import { compilePluginContractToNoVARuntimeManifest, type NoVAPluginContract } from './runtime/manifest'

const pluginFixture: NoVAPluginContract = {
  pluginId: 'example-plugin',
  displayName: 'Example Vertical',
  contractVersion: '1.0',
  capabilities: ['example-intelligence'],
  entities: [{ id: 'account', label: 'Account', description: 'Example account context.' }],
  signals: [{ id: 'account-risk', label: 'Account Risk', description: 'Example risk signal.', entityIds: ['account'] }],
  tools: [
    { id: 'account-data', description: 'Read account data.', requiresApproval: false },
    { id: 'account-action', description: 'Prepare an account action.', requiresApproval: true },
  ],
  agents: [{
    id: 'example-agent',
    name: 'Example Agent',
    description: 'Example vertical intelligence agent.',
    intelligenceKind: 'custom' as const,
    capabilities: ['analysis'],
    allowedTools: ['account-data', 'account-action'],
    context: { entityIds: ['account'], signalIds: ['account-risk'] },
    autonomy: 'prepare' as const,
  }],
  governanceRequirements: { approvalForConsequentialActions: true },
  executionAuthority: 'nova-core' as const,
}

describe('ARRIYIA V2 release certification fixtures', () => {
  it('uses one canonical autonomy vocabulary', () => {
    expect(AUTONOMY_LEVELS).toEqual(['inform', 'recommend', 'prepare', 'bounded'])
    expect(autonomyAtMost('prepare', 'bounded')).toBe(true)
    expect(autonomyAtMost('bounded', 'prepare')).toBe(false)
  })

  it('keeps external plugin metadata declarative and NoVA-owned', () => {
    const manifest = compilePluginContractToNoVARuntimeManifest(pluginFixture)
    expect(manifest.plugin.id).toBe('example-plugin')
    expect(manifest.plugin.executionAuthority).toBe('nova-core')
    expect(manifest.governance.approvalForConsequentialActions).toBe(true)
  })

  it('blocks consequential authorization without exact active approval', () => {
    const result = evaluateAuthorizationEnvelope({
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      actionId: 'action-1',
      requestedAutonomy: 'prepare',
      agentAutonomyCeiling: 'prepare',
      tool: {
        id: 'purchase-orders',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        requiresApproval: true,
      },
      correlationId: 'corr-1',
    })
    expect(result.decision).toBe('requires_approval')
    expect(result.envelope.requiresApproval).toBe(true)
  })

  it('requires the runtime handoff to carry an authorized governance envelope', () => {
    const request: ToolInvocationRequest = {
      contractVersion: '1.0.0',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      toolId: 'purchase-orders',
      input: {},
      authorization: {
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        agentId: 'agent-1',
        actionId: 'action-1',
        toolId: 'purchase-orders',
        requestedAutonomy: 'prepare',
        agentAutonomyCeiling: 'prepare',
        decision: 'authorized',
        requiresApproval: true,
        approvalId: 'approval-1',
        contextIds: ['ctx-1'],
        provenanceIds: ['source-1'],
        correlationId: 'corr-1',
      },
    }
    expect(() => validateToolInvocationRequest(request)).not.toThrow()
    expect(() => validateToolInvocationRequest({
      ...request,
      authorization: { ...request.authorization, approvalId: undefined },
    })).toThrow('approval reference')
  })
})
