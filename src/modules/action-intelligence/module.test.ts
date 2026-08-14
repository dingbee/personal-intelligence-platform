import { describe, expect, it } from 'vitest'
import '@/modules/action-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'
import { ACTION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/actionIntelligence'

describe('action-intelligence module registration', () => {
  it('registers exactly one capability for the module', () => {
    const capabilities = capabilityRegistry.list().filter((c) => c.moduleId === 'action-intelligence')
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0]?.id).toBe('action-generate-action-set')
  })

  it('gates action-generate-action-set on the dedicated action_intelligence feature key, distinct from every sibling engine', () => {
    const capability = capabilityRegistry.get('action-generate-action-set')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe(ACTION_INTELLIGENCE_FEATURE_KEY)
    expect(capability?.requiredFeature).toBe('action_intelligence')
    expect(capability?.requiredFeature).not.toBe('decision_intelligence')
    expect(capability?.requiredFeature).not.toBe('planning_intelligence')
    expect(capability?.requiredFeature).not.toBe('research_intelligence')
    expect(capability?.requiredFeature).not.toBe('analysis_intelligence')
    expect(capability?.requiredFeature).not.toBe('data_intelligence')
    expect(capability?.requiredFeature).not.toBe('pro_intelligence')
  })

  it('registers an active prompt template requiring strict structured JSON output and the five action-type distinctions', () => {
    const template = getActivePrompt('action-generate-action-set')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    expect(template?.template).toContain('{{actionSummary}}')
    expect(template?.template).toContain('"actions"')
    expect(template?.template).toContain('"dependsOn"')
    expect(template?.template.toLowerCase()).toContain('decision_required')
    expect(template?.template.toLowerCase()).toContain('information_request')
    expect(template?.template).toContain('do NOT decide whether an action is ready')
  })
})
