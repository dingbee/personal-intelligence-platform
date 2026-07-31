import { normalizeGeneratedTitle } from '@/modules/intelligence/conversation/conversationTitle/titleNormalizer'
import { computeTitleConfidence, type TitleSource } from '@/modules/intelligence/conversation/conversationTitle/titleConfidence'

export interface GeneratedTitle {
  title: string
  confidence: number
  generated: true
}

const MAX_FALLBACK_WORDS = 6
const FALLBACK_TITLE = 'General Discussion'

/**
 * Words that carry no topical meaning for a *single* opening message: basic
 * function words plus the request-framing verbs people open a chat with
 * ("help me...", "explain...", "plan..."). Deliberately its own list rather
 * than reusing workspaceInsightEngine's STOPWORDS — that one is tuned for
 * frequency-counting across many titles/memory rows and keeps words (like
 * "chat", "new") this single-message extractor needs to treat differently.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'with', 'about',
  'into', 'from', 'by', 'as', 'that', 'this', 'these', 'those', 'it', 'its',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'us', 'our',
  'they', 'them', 'their', 'he', 'she', 'his', 'her', 'do', 'does', 'did',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might',
  'must', 'have', 'has', 'had',
  // request-framing verbs — meta-language about the ask, not its topic
  'help', 'want', 'need', 'like', 'explain', 'plan', 'design', 'create',
  'make', 'build', 'write', 'tell', 'show', 'give', 'find', 'get',
  'figure', 'think', 'know', 'understand',
])

/**
 * UX-13.5A — deterministic fallback: extracts the message's significant
 * words (stopwords/request-framing verbs removed) in their original order,
 * capped to MAX_FALLBACK_WORDS. This is the "no AI available" path — used
 * directly when the AI capability call fails or is unavailable, and also
 * as the safety net if the AI's own candidate fails normalization.
 */
export function generateFallbackTitle(message: string): string {
  const words = message
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter((w) => w.length > 0 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, MAX_FALLBACK_WORDS)

  if (words.length === 0) return FALLBACK_TITLE

  const normalized = normalizeGeneratedTitle(words.join(' '))
  return normalized ?? FALLBACK_TITLE
}

/**
 * UX-13.5A — the single point where an AI-generated candidate (possibly
 * null, when the capability call failed or was unavailable) and the
 * message it was generated from converge into a real, guaranteed-valid
 * title. Every path — AI success, AI candidate rejected by
 * normalizeGeneratedTitle, AI unavailable — ends in a usable title; there
 * is no code path that surfaces "New Conversation" once this is wired in.
 */
export function finalizeGeneratedTitle(aiCandidate: string | null, firstMessage: string): GeneratedTitle {
  const normalizedAiCandidate = aiCandidate ? normalizeGeneratedTitle(aiCandidate) : null

  const source: TitleSource = normalizedAiCandidate ? 'ai' : 'fallback'
  const title = normalizedAiCandidate ?? generateFallbackTitle(firstMessage)
  const wordCount = title.split(/\s+/).filter(Boolean).length

  return { title, confidence: computeTitleConfidence({ source, wordCount }), generated: true }
}
