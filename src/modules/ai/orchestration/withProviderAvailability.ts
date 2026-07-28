import type { QueryClient } from '@tanstack/react-query'
import { normalizeAiError } from '@/modules/ai/orchestration/normalizeAiError'
import {
  isProviderAvailable,
  PROVIDER_UNAVAILABLE_MESSAGE,
  type ProviderAvailability,
  type ProviderOverrides,
} from '@/modules/ai/providers/availability'

export interface ProviderGuardDeps {
  availability: ProviderAvailability | undefined
  overrides?: ProviderOverrides
  queryClient: QueryClient
}

/**
 * The shared choke point every runCapability consumer goes through: refuses
 * to spend a request on a provider already known to be unavailable, and
 * normalizes whatever the wrapped call throws into a message safe to show
 * a user. Generic over the return type so it wraps both a single
 * runCapability call and a composite workflow like runKnowledgeExtraction
 * (which itself makes several runCapability calls against the same
 * implicit default provider) identically.
 */
export async function withProviderAvailability<T>(
  providerId: string,
  run: () => Promise<T>,
  deps: ProviderGuardDeps,
): Promise<T> {
  if (!isProviderAvailable(providerId, deps.availability, deps.overrides)) {
    throw new Error(PROVIDER_UNAVAILABLE_MESSAGE)
  }

  try {
    return await run()
  } catch (err) {
    const normalized = normalizeAiError(err)
    if (normalized.isProviderUnavailable) {
      void deps.queryClient.invalidateQueries({ queryKey: ['provider-availability'] })
    }
    throw new Error(normalized.message)
  }
}
