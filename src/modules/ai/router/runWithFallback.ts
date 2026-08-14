import { PROVIDER_UNAVAILABLE_MESSAGE } from '@/modules/ai/providers/availability'

export interface FallbackResult<T> {
  result: T
  /** Which candidate actually succeeded — chain[0] unless it failed and a later candidate picked up the request. */
  providerId: string
}

/**
 * Tries each candidate in `chain`, in order, returning on the first
 * success. Scoped to a single request/operation only — no retry loop
 * within one candidate, no persistence of the outcome anywhere here
 * (callers decide what, if anything, to log or store). An empty chain
 * means candidacy filtering already found nothing eligible.
 *
 * `shouldAbort` (Operation Budget Foundation) is checked before each
 * candidate attempt, including the first — an optional, backward-
 * compatible hook so a budget-aware caller (see
 * intelligenceOperations.ts's runOperationAiCall) can stop trying
 * further candidates once an external limit (an AI-call budget) is hit
 * mid-chain, without this generic function knowing anything about what
 * that limit is. Existing callers that never pass it are unaffected.
 */
export async function runWithFallback<T>(
  chain: string[],
  run: (providerId: string) => Promise<T>,
  options?: { shouldAbort?: () => boolean },
): Promise<FallbackResult<T>> {
  if (chain.length === 0) throw new Error(PROVIDER_UNAVAILABLE_MESSAGE)

  let lastError: unknown
  for (const providerId of chain) {
    if (options?.shouldAbort?.()) throw lastError ?? new Error('Aborted before any candidate was attempted.')
    try {
      const result = await run(providerId)
      return { result, providerId }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
