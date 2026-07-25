import { createRegistry } from '@/modules/core/registry'
import type { SearchProvider } from '@/modules/search/types'

// Reuses the same generic registry mechanism as modules/core's four
// registries — search providers are exactly the same shape of extension
// point (a domain-specific implementation of a shared interface), just
// scoped to this module rather than modules/core since "search" is its
// own platform concern, not something every domain module touches.
export const searchProviderRegistry = createRegistry<SearchProvider>()
