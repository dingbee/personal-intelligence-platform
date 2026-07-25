import { createRegistry } from '@/modules/core/registry'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'

export const providerRegistry = createRegistry<AIProviderDescriptor>()
