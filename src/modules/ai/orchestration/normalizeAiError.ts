import { isProviderUnavailableError, PROVIDER_UNAVAILABLE_MESSAGE } from '@/modules/ai/providers/availability'

export interface NormalizedAiError {
  message: string
  isProviderUnavailable: boolean
}

/**
 * Turns a raw AI-call failure into a message safe to show a user — never
 * the raw "X_API_KEY is not configured" (or other upstream) text. Reused
 * by chat's send path and, via withProviderAvailability, by every
 * runCapability consumer, so a new failure shape only needs handling here.
 */
export function normalizeAiError(err: unknown): NormalizedAiError {
  const rawMessage = err instanceof Error ? err.message : 'The AI request failed.'
  if (isProviderUnavailableError(rawMessage)) {
    return { message: PROVIDER_UNAVAILABLE_MESSAGE, isProviderUnavailable: true }
  }
  return { message: rawMessage, isProviderUnavailable: false }
}
