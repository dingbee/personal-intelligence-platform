import { describe, expect, it } from 'vitest'
import '@/modules/research-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'
import { RESEARCH_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/researchIntelligence'

describe('research-intelligence module registration', () => {
  it('registers exactly one capability for the module', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'research-intelligence')
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0]?.id).toBe('research-synthesis')
  })

  it('gates research-synthesis on the dedicated research_intelligence feature key, distinct from analysis/data/pro intelligence', () => {
    const capability = capabilityRegistry.get('research-synthesis')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe(RESEARCH_INTELLIGENCE_FEATURE_KEY)
    expect(capability?.requiredFeature).toBe('research_intelligence')
    expect(capability?.requiredFeature).not.toBe('analysis_intelligence')
    expect(capability?.requiredFeature).not.toBe('data_intelligence')
    expect(capability?.requiredFeature).not.toBe('pro_intelligence')
  })

  it('registers an active prompt template requiring structured JSON output and causation discipline', () => {
    const template = getActivePrompt('research-synthesis')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{researchSummary}}')
    expect(template?.template.toLowerCase()).toContain('causal')
    expect(template?.template).toContain('"keyFindings"')
  })
})
