import { describe, expect, it } from 'vitest'
import '@/modules/domain-intelligence/module'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { promptRegistry } from '@/modules/core/prompts/registry'
import { DOMAIN_CAPABILITY_DEFINITIONS, buildDomainCapabilityPrompt, DOMAIN_CAPABILITY_FEATURE_KEY, getDomainCapabilityDefinition } from '@/modules/domain-intelligence/domainCapabilities'
import { INTELLIGENCE_DOMAIN_KEYS } from '@/modules/intelligence-ledger/domainContract'

describe('IF-03 domain capability definitions', () => {
  it('defines exactly one specialization for every canonical domain key', () => {
    expect(DOMAIN_CAPABILITY_DEFINITIONS.map(item => item.domain)).toEqual(INTELLIGENCE_DOMAIN_KEYS)
    expect(new Set(DOMAIN_CAPABILITY_DEFINITIONS.map(item => item.domain)).size).toBe(8)
  })

  it('registers one gated capability and one active prompt per domain', () => {
    for (const definition of DOMAIN_CAPABILITY_DEFINITIONS) {
      const capabilityId = `domain-${definition.domain}-assessment`
      const capability = capabilityRegistry.get(capabilityId)
      expect(capability).toMatchObject({
        id: capabilityId,
        moduleId: 'domain-intelligence',
        requiredFeature: 'domain_intelligence',
      })
      const prompts = promptRegistry.list().filter(prompt => prompt.capabilityId === capabilityId)
      expect(prompts).toHaveLength(1)
      expect(prompts[0]).toMatchObject({
        id: `${capabilityId}@1.0`,
        active: true,
        moduleId: 'domain-intelligence',
      })
    }
  })

  it('gates every domain on the shared domain-intelligence entitlement', () => {
    expect(DOMAIN_CAPABILITY_FEATURE_KEY).toBe('domain_intelligence')
  })

  it('requires evidence-grounded, approval-gated output from every domain prompt', () => {
    for (const definition of DOMAIN_CAPABILITY_DEFINITIONS) {
      const prompt = buildDomainCapabilityPrompt(definition)
      expect(prompt).toContain(`"domain": "${definition.domain}"`)
      expect(prompt).toContain('requiresApproval": true')
      expect(prompt).toContain('never fabricate source references')
      expect(prompt).toContain('Do not perform external actions')
      expect(prompt).toContain('{{question}}')
      expect(prompt).toContain('{{context}}')
    }
  })

  it('includes distinct domain guardrails for higher-risk domains', () => {
    expect(getDomainCapabilityDefinition('hr').guardrails.join(' ')).toContain('protected characteristics')
    expect(getDomainCapabilityDefinition('legal').guardrails.join(' ')).toContain('qualified counsel')
    expect(getDomainCapabilityDefinition('risk').guardrails.join(' ')).toContain('probabilities')
  })

  it('rejects unknown domain keys at lookup time', () => {
    expect(() => getDomainCapabilityDefinition('not-a-domain' as never)).toThrow('Unknown intelligence domain')
  })
})
