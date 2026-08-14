import { describe, expect, it } from 'vitest'
import '@/modules/decision-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'
import { DECISION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/decisionIntelligence'

describe('decision-intelligence module registration', () => {
  it('registers exactly one capability for the module', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'decision-intelligence')
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0]?.id).toBe('decision-generate-recommendation')
  })

  it('gates decision-generate-recommendation on the dedicated decision_intelligence feature key, distinct from every sibling engine', () => {
    const capability = capabilityRegistry.get('decision-generate-recommendation')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe(DECISION_INTELLIGENCE_FEATURE_KEY)
    expect(capability?.requiredFeature).toBe('decision_intelligence')
    expect(capability?.requiredFeature).not.toBe('planning_intelligence')
    expect(capability?.requiredFeature).not.toBe('research_intelligence')
    expect(capability?.requiredFeature).not.toBe('analysis_intelligence')
    expect(capability?.requiredFeature).not.toBe('data_intelligence')
    expect(capability?.requiredFeature).not.toBe('pro_intelligence')
  })

  it('registers an active prompt template requiring strict structured JSON output and the KNOWN/ASSUMED/UNKNOWN discipline', () => {
    const template = getActivePrompt('decision-generate-recommendation')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{decisionSummary}}')
    expect(template?.template).toContain('"alternatives"')
    expect(template?.template).toContain('"criteria"')
    expect(template?.template).toContain('"evaluations"')
    expect(template?.template.toLowerCase()).toContain('requires_user_input')
    expect(template?.template).toContain('never state a final weighted score')
  })
})
