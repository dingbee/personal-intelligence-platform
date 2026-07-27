import { createRegistry } from '@/modules/core/registry'
import type { LinkResolver } from '@/modules/knowledgeLinks/types'

// Reuses the same generic registry mechanism as modules/search's
// searchProviderRegistry and modules/core's four registries.
export const linkResolverRegistry = createRegistry<LinkResolver>()
