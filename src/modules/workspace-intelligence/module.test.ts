import { describe, expect, it } from 'vitest'
import '@/modules/workspace-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getActivePrompt } from '@/modules/core/prompts/registry'

/**
 * Phase P1 Advanced AI Workspace — confirms the real registration (not a
 * mock) so this is a genuine check that the shipped capability is wired
 * to Phase P0's entitlement layer, not just something a unit test's
 * mocks assert about.
 */
describe('workspace-intelligence module registration', () => {
  it('registers workspace-briefing as a Pro Intelligence-gated capability', () => {
    const capability = capabilityRegistry.get('workspace-briefing')
    expect(capability).toBeDefined()
    expect(capability?.requiredFeature).toBe('pro_intelligence')
    expect(capability?.label).toBe('Workspace Briefing')
  })

  it('registers an active prompt template for workspace-briefing referencing the expected context variables', () => {
    const template = getActivePrompt('workspace-briefing')
    expect(template).toBeDefined()
    expect(template?.active).toBe(true)
    for (const variable of ['{{workspaceName}}', '{{objectives}}', '{{recentActivity}}', '{{established}}', '{{unresolved}}', '{{recommendedNext}}']) {
      expect(template?.template).toContain(variable)
    }
  })
})
