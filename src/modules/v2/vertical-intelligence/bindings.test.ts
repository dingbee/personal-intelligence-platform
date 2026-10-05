import { describe, expect, it } from 'vitest'
import { bindVerticalAgents, validateVerticalAgentContractBinding } from './bindings'
import type { VerticalRegistration } from './types'

const fixture: VerticalRegistration = {
  verticalId: 'example-vertical',
  displayName: 'Example Vertical',
  contractVersion: '1.0',
  capabilities: ['example-intelligence'],
  entities: [
    { id: 'account', label: 'Account', description: 'Example account context.' },
  ],
  signals: [
    { id: 'account-risk', label: 'Account Risk', description: 'Example risk signal.', entityIds: ['account'] },
  ],
  tools: [
    { id: 'account-data', description: 'Read account data.', requiresApproval: false },
    { id: 'account-action', description: 'Prepare an account action.', requiresApproval: true },
  ],
  agents: [
    {
      id: 'example-agent',
      name: 'Example Agent',
      description: 'Example vertical intelligence agent.',
      intelligenceKind: 'custom',
      capabilities: ['analysis'],
      allowedTools: ['account-data', 'account-action'],
      context: { entityIds: ['account'], signalIds: ['account-risk'] },
      autonomy: 'prepare',
    },
  ],
  governanceRequirements: {
    approvalForConsequentialActions: true,
  },
  executionAuthority: 'nova-core',
}

describe('V2 generic vertical contract boundary', () => {
  it('binds an externally supplied registration without product-specific knowledge', () => {
    const [binding] = bindVerticalAgents(fixture)

    expect(binding).toBeDefined()
    if (!binding) throw new Error('Expected a generic vertical binding.')

    expect(binding.verticalId).toBe('example-vertical')
    expect(binding.executionAuthority).toBe('nova-core')
    expect(binding.executionEnabled).toBe(false)
    expect(binding.governanceRequired).toBe(true)
    expect(binding.approvalRequiredForConsequentialActions).toBe(true)
    expect(validateVerticalAgentContractBinding(binding)).toEqual([])
  })

  it('rejects a binding that attempts to enable execution', () => {
    const [binding] = bindVerticalAgents(fixture)
    expect(binding).toBeDefined()
    if (!binding) throw new Error('Expected a generic vertical binding.')

    const invalid = { ...binding, executionEnabled: true as false }
    expect(validateVerticalAgentContractBinding(invalid)).toContain(
      'V2 binding must not enable execution',
    )
  })

  it('rejects a tool contract that crosses the vertical boundary', () => {
    const [binding] = bindVerticalAgents(fixture)
    expect(binding).toBeDefined()
    if (!binding) throw new Error('Expected a generic vertical binding.')

    const invalid = {
      ...binding,
      tools: binding.tools.map((tool, index) =>
        index === 0 ? { ...tool, verticalId: 'other-vertical' } : tool,
      ),
    }

    expect(validateVerticalAgentContractBinding(invalid)).toContain(
      'Tool contract crosses vertical boundary: account-data',
    )
  })
})
