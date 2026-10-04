import { describe, expect, it } from 'vitest'
import { bindVerticalAgents, validateVerticalAgentContractBinding } from './bindings'
import { lexibiteIntelligence } from './lexibite'
import { staynasIntelligence } from './staynas'

describe('V2-12 vertical agent contract bindings', () => {
  it('binds every StayNas agent to its vertical context and NoVA Core authority', () => {
    const bindings = bindVerticalAgents(staynasIntelligence)

    expect(bindings).toHaveLength(staynasIntelligence.agents.length)

    for (const binding of bindings) {
      expect(binding.verticalId).toBe('staynas')
      expect(binding.executionAuthority).toBe('nova-core')
      expect(binding.executionEnabled).toBe(false)
      expect(binding.governanceRequired).toBe(true)
      expect(binding.approvalRequiredForConsequentialActions).toBe(true)
      expect(validateVerticalAgentContractBinding(binding)).toEqual([])
      expect(binding.context.id).toContain('v2:context:staynas:')
      expect(binding.tools.every((tool) => tool.verticalId === 'staynas')).toBe(true)
    }
  })

  it('binds every LexiBite agent without crossing the vertical boundary', () => {
    const bindings = bindVerticalAgents(lexibiteIntelligence)

    expect(bindings).toHaveLength(lexibiteIntelligence.agents.length)

    for (const binding of bindings) {
      expect(binding.verticalId).toBe('lexibite')
      expect(binding.executionAuthority).toBe('nova-core')
      expect(binding.executionEnabled).toBe(false)
      expect(validateVerticalAgentContractBinding(binding)).toEqual([])
      expect(binding.tools.every((tool) => tool.verticalId === 'lexibite')).toBe(true)
    }
  })

  it('keeps LexiBite Inventory Intelligence inside the intended stock-to-replenishment contract', () => {
    const agent = lexibiteIntelligence.agents.find(
      (candidate) => candidate.id === 'lexibite-inventory-intelligence',
    )
    expect(agent).toBeDefined()

    const binding = bindVerticalAgents(lexibiteIntelligence).find(
      (candidate) => candidate.agentId === 'lexibite-inventory-intelligence',
    )
    expect(binding).toBeDefined()

    expect(agent?.autonomy).toBe('prepare')
    expect(agent?.capabilities).toEqual(
      expect.arrayContaining([
        'stock-analysis',
        'consumption-analysis',
        'demand-forecast',
        'replenishment-recommendation',
      ]),
    )
    expect(binding?.tools.map((tool) => tool.toolId)).toEqual(
      expect.arrayContaining(['stock-ledger', 'recipes', 'orders', 'purchasing']),
    )
  })

  it('requires approval when a consequential tool is declared', () => {
    const binding = bindVerticalAgents(lexibiteIntelligence).find(
      (candidate) => candidate.agentId === 'lexibite-procurement-intelligence',
    )
    expect(binding).toBeDefined()

    const purchasingTool = binding?.tools.find((tool) => tool.toolId === 'purchasing')
    const purchaseOrdersTool = binding?.tools.find((tool) => tool.toolId === 'purchase-orders')

    expect(purchasingTool?.consequential).toBe(true)
    expect(purchaseOrdersTool?.consequential).toBe(true)
    expect(binding?.governanceRequired).toBe(true)
    expect(binding?.approvalRequiredForConsequentialActions).toBe(true)
    expect(binding?.executionEnabled).toBe(false)
  })

  it('treats approval as a governance gate rather than an autonomy level', () => {
    const bindings = bindVerticalAgents(staynasIntelligence)
    expect(bindings.every((binding) => binding.autonomyCeiling !== ('approve' as never))).toBe(true)
  })

  it('rejects a binding with an invalid autonomy ceiling', () => {
    const binding = bindVerticalAgents(staynasIntelligence)[0]
    const invalid = { ...binding, autonomyCeiling: 'autonomous' as never }
    expect(validateVerticalAgentContractBinding(invalid)).toContain('Binding contains an invalid autonomy ceiling')
  })

  it('rejects a binding that attempts to bypass the governance boundary', () => {
    const binding = bindVerticalAgents(staynasIntelligence)[0]
    const invalid = {
      ...binding,
      executionEnabled: true as false,
    }

    expect(validateVerticalAgentContractBinding(invalid)).toContain(
      'V2-12 binding must not enable execution',
    )
  })

  it('rejects a binding whose tool contract crosses the vertical boundary', () => {
    const binding = bindVerticalAgents(lexibiteIntelligence)[0]
    const invalid = {
      ...binding,
      tools: binding.tools.map((tool, index) =>
        index === 0 ? { ...tool, verticalId: 'staynas' as const } : tool,
      ),
    }

    expect(validateVerticalAgentContractBinding(invalid)).toContain(
      `Tool contract crosses vertical boundary: ${invalid.tools[0].toolId}`,
    )
  })
})
