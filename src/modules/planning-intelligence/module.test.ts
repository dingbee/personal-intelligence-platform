import { describe, expect, it } from 'vitest'
import '@/modules/planning-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'

describe('planning-intelligence module registration', () => {
  it('registers exactly two capabilities for the module — plan generation and plan revision', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'planning-intelligence')
    expect(capabilities).toHaveLength(2)
    expect(capabilities.map((c) => c.id).sort()).toEqual(['planning-generate-plan', 'planning-revise-plan'])
  })

  it('gates both capabilities on the SAME dedicated planning_intelligence feature key, distinct from every sibling engine — one domain, not two entitlements', () => {
    for (const capabilityId of ['planning-generate-plan', 'planning-revise-plan']) {
      const capability = capabilityRegistry.get(capabilityId)
      expect(capability).toBeDefined()
      expect(capability?.requiredFeature).toBe(PLANNING_INTELLIGENCE_FEATURE_KEY)
      expect(capability?.requiredFeature).toBe('planning_intelligence')
      expect(capability?.requiredFeature).not.toBe('research_intelligence')
      expect(capability?.requiredFeature).not.toBe('analysis_intelligence')
      expect(capability?.requiredFeature).not.toBe('data_intelligence')
      expect(capability?.requiredFeature).not.toBe('pro_intelligence')
    }
  })

  it('registers an active plan-revision prompt template requiring real-id reuse for unaffected items', () => {
    const template = getActivePrompt('planning-revise-plan')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{revisionSummary}}')
    expect(template?.template.toLowerCase()).toContain('reuse')
    expect(template?.template).toContain('"tasks"')
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
