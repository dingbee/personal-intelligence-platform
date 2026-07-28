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
 */
export async function runWithFallback<T>(chain: string[], run: (providerId: string) => Promise<T>): Promise<FallbackResult<T>> {
  if (chain.length === 0) throw new Error(PROVIDER_UNAVAILABLE_MESSAGE)

  let lastError: unknown
  for (const providerId of chain) {
    try {
      const result = await run(providerId)
      return { result, providerId }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
