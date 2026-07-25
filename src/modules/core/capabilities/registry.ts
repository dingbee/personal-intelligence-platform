import { createRegistry } from '@/modules/core/registry'
import type { AICapability } from '@/modules/core/capabilities/types'

export const capabilityRegistry = createRegistry<AICapability>()
