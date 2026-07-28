import { isProviderUnavailableError, PROVIDER_UNAVAILABLE_MESSAGE } from '@/modules/ai/providers/availability'
import { AI_REQUEST_TIMEOUT_MESSAGE } from '@/modules/ai/providers/edgeFunctionClient'

export type AiErrorCategory = 'provider_unavailable' | 'rate_limited' | 'timeout' | 'invalid_response' | 'unknown'

export interface NormalizedAiError {
  category: AiErrorCategory
  /** Safe to show a user — never raw upstream/config error text. */
  message: string
  /** The original, unmodified error text — for logs/debugging only, never rendered. ai_requests logging already captures this independently at streamChatCompletion, before any normalization; this is kept here too for any future caller that only has a NormalizedAiError to work with. */
  technicalMessage: string
  /** @deprecated equivalent to `category === 'provider_unavailable'` — kept so existing call sites (useSendMessage, withProviderAvailability) don't need to change when a category is all they need. */
  isProviderUnavailable: boolean
}

const CATEGORY_MESSAGES: Record<AiErrorCategory, string> = {
  provider_unavailable: PROVIDER_UNAVAILABLE_MESSAGE,
  rate_limited: 'This AI provider is temporarily rate-limited. Please wait a moment and try again.',
  timeout: 'The AI took too long to respond. Please try again.',
  invalid_response: 'The AI returned an unexpected response. Please try again.',
  unknown: 'Something went wrong generating a response. Please try again.',
}

/**
 * Matches against the exact error shapes this app's AI call chain actually
 * produces today:
 * - provider_unavailable: ai-chat's 500 "<PROVIDER>_API_KEY is not
 *   configured" (see isProviderUnavailableError).
 * - timeout: streamAiChat's own idle-timeout abort (see
 *   edgeFunctionClient.ts) — a client-side condition, not a server response.
 * - rate_limited: ai-chat always relabels upstream failures as a 502, with
 *   the real upstream status (429) and/or "rate limit"/"quota" wording
 *   embedded in the forwarded text.
 * - invalid_response: streamAiChat's own "no body" check, for a 200 with a
 *   missing stream body.
 * - unknown: anything else (network errors, unexpected exceptions).
 */
function categorizeAiError(message: string): AiErrorCategory {
  if (isProviderUnavailableError(message)) return 'provider_unavailable'
  if (message.includes(AI_REQUEST_TIMEOUT_MESSAGE)) return 'timeout'
  if (/\b429\b/.test(message) || /rate.?limit/i.test(message) || /quota/i.test(message)) return 'rate_limited'
  if (/invalid response|no body/i.test(message)) return 'invalid_response'
  return 'unknown'
}

/**
 * Turns a raw AI-call failure into a message safe to show a user, tagged
 * with a category. Reused by chat's send path and, via
 * withProviderAvailability, by every runCapability consumer (Chapter
 * Summary, Flashcards, Note Summarize, Knowledge Extraction) — extending
 * the categories here upgrades all of them at once, since every one of
 * those already calls this function; none of them needed to change for
 * this phase.
 */
export function normalizeAiError(err: unknown): NormalizedAiError {
  const rawMessage = err instanceof Error ? err.message : 'The AI request failed.'
  const category = categorizeAiError(rawMessage)
  return {
    category,
    message: CATEGORY_MESSAGES[category],
    technicalMessage: rawMessage,
    isProviderUnavailable: category === 'provider_unavailable',
  }
}
