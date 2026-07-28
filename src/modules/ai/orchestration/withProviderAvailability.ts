import type { QueryClient } from '@tanstack/react-query'
import { normalizeAiError } from '@/modules/ai/orchestration/normalizeAiError'
import { PROVIDER_UNAVAILABLE_MESSAGE } from '@/modules/ai/providers/availability'

export interface ProviderGuardDeps {
  queryClient: QueryClient
}

/**
 * The shared choke point every runCapability consumer goes through: refuses
 * to spend a request when the caller's whole provider chain came back
 * empty (resolveProviderChain already applied availability + overrides +
 * registry filtering to produce it, so an empty chain means nothing
 * eligible survived — no separate re-check needed here), and normalizes
 * whatever the wrapped call throws into a message safe to show a user.
 * Generic over the return type so it wraps both a single runCapability
 * call and a composite workflow like runKnowledgeExtraction identically.
 */
export async function withProviderAvailability<T>(
  chain: string[],
  run: () => Promise<T>,
  deps: ProviderGuardDeps,
): Promise<T> {
  if (chain.length === 0) {
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
