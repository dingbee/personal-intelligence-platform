import { describe, expect, it } from 'vitest'
import '@/modules/analysis-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'

describe('analysis-intelligence module registration', () => {
  it('registers exactly one capability for the module', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'analysis-intelligence')
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0]?.id).toBe('analysis-investigation-synthesis')
  })

  it('gates analysis-investigation-synthesis on the dedicated analysis_intelligence feature key, distinct from data_intelligence and pro_intelligence', () => {
    const capability = capabilityRegistry.get('analysis-investigation-synthesis')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe('analysis_intelligence')
    expect(capability?.requiredFeature).not.toBe('data_intelligence')
    expect(capability?.requiredFeature).not.toBe('pro_intelligence')
  })

  it('registers an active prompt template referencing the investigation summary and causation discipline', () => {
    const template = getActivePrompt('analysis-investigation-synthesis')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{investigationSummary}}')
    expect(template?.template.toLowerCase()).toContain('causal')
  })
})
