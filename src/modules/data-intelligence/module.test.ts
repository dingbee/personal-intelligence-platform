import { describe, expect, it } from 'vitest'
import '@/modules/data-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'

/**
 * Data Intelligence Foundation — confirms the real registration (not a
 * mock): exactly ONE externally-exposed capability, gated on the
 * dedicated 'data_intelligence' key (not 'pro_intelligence' — see
 * plans/dataIntelligence.ts).
 */
describe('data-intelligence module registration', () => {
  it('registers exactly one capability for the module', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'data-intelligence')
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0]?.id).toBe('data-intelligence-query')
  })

  it('gates data-intelligence-query on the dedicated data_intelligence feature key', () => {
    const capability = capabilityRegistry.get('data-intelligence-query')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe('data_intelligence')
    expect(capability?.requiredFeature).not.toBe('pro_intelligence')
  })

  it('registers an active prompt template referencing the question and computed result', () => {
    const template = getActivePrompt('data-intelligence-query')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{question}}')
    expect(template?.template).toContain('{{resultSummary}}')
  })
})
