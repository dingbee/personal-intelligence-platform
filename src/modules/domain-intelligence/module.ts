import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'
import { DOMAIN_CAPABILITY_DEFINITIONS, buildDomainCapabilityPrompt, DOMAIN_CAPABILITY_FEATURE_KEY } from '@/modules/domain-intelligence/domainCapabilities'

/**
 * IF-03: eight domain lenses over the shared intelligence substrate.
 * This deliberately adds prompt/context specializations to the existing
 * capability registry; it does not create vertical-specific engines,
 * retrieval stacks, ledgers, or authorization systems.
 */
registerPlatformModule({
  id: 'domain-intelligence',
  name: 'Domain Intelligence',
  capabilities: DOMAIN_CAPABILITY_DEFINITIONS.map(definition => ({
    id: `domain-${definition.domain}-assessment`,
    label: definition.label,
    description: definition.description,
    requiredFeature: DOMAIN_CAPABILITY_FEATURE_KEY,
  })),
  prompts: DOMAIN_CAPABILITY_DEFINITIONS.map(definition => ({
    id: `domain-${definition.domain}-assessment@1.0`,
    capabilityId: `domain-${definition.domain}-assessment`,
    version: '1.0',
    active: true,
    template: buildDomainCapabilityPrompt(definition),
  })),
})
