import { describe, expect, it } from 'vitest'
import '@/modules/planning-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'

describe('planning-intelligence module registration', () => {
  it('registers exactly one capability for the module', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'planning-intelligence')
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0]?.id).toBe('planning-generate-plan')
  })

  it('gates planning-generate-plan on the dedicated planning_intelligence feature key, distinct from every sibling engine', () => {
    const capability = capabilityRegistry.get('planning-generate-plan')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe(PLANNING_INTELLIGENCE_FEATURE_KEY)
    expect(capability?.requiredFeature).toBe('planning_intelligence')
    expect(capability?.requiredFeature).not.toBe('research_intelligence')
    expect(capability?.requiredFeature).not.toBe('analysis_intelligence')
    expect(capability?.requiredFeature).not.toBe('data_intelligence')
    expect(capability?.requiredFeature).not.toBe('pro_intelligence')
  })

  it('registers an active prompt template requiring strict structured JSON output and the KNOWN/ASSUMED/UNKNOWN discipline', () => {
    const template = getActivePrompt('planning-generate-plan')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{planningSummary}}')
    expect(template?.template).toContain('"milestones"')
    expect(template?.template).toContain('"tasks"')
    expect(template?.template.toLowerCase()).toContain('assumed')
    expect(template?.template.toLowerCase()).toContain('requires_user_input'.toLowerCase())
    expect(template?.template).toContain('do not invent one')
  })
})
