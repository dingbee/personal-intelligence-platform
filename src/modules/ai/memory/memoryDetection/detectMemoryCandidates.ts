import type { AiMemoryType } from '@/shared/types/database'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'
import { containsSensitiveTopic } from '@/modules/ai/memory/memoryDetection/sensitiveTopics'
import { scoreMemoryConfidence } from '@/modules/ai/memory/memoryDetection/scoreMemoryConfidence'

/** Below this, a candidate isn't worth surfacing for approval at all. */
const MIN_CONFIDENCE = 0.4

function clean(capture: string | undefined): string {
  return (capture ?? '').replace(/[.,!?;:]+\s*$/, '').trim()
}

interface DetectionPattern {
  regex: RegExp
  type: AiMemoryType
  /** How durable/explicit this statement shape is, before scoreMemoryConfidence's linguistic adjustments — mirrors the same explicit > preference > conversation trust order as formatMemoriesForPrompt's SECTION_ORDER. */
  baseConfidence: number
  buildContent: (match: RegExpExecArray) => string
}

const PATTERNS: DetectionPattern[] = [
  {
    regex: /\bmy name is ([a-z][\w'-]*(?:\s[a-z][\w'-]*)?)/i,
    type: 'explicit_profile',
    baseConfidence: 0.95,
    buildContent: (m) => `User's name is ${clean(m[1])}.`,
  },
  {
    regex: /\bmy (son|daughter|wife|husband|partner|mother|father|sister|brother) is named ([a-z][\w'-]*)/i,
    type: 'explicit_profile',
    baseConfidence: 0.95,
    buildContent: (m) => `User has a ${m[1]} named ${clean(m[2])}.`,
  },
  {
    regex: /\bi (?:live|reside) in ([a-z][\w\s,'-]*)/i,
    type: 'explicit_profile',
    baseConfidence: 0.9,
    buildContent: (m) => `User lives in ${clean(m[1])}.`,
  },
  {
    regex: /\bi work (?:at|for) ([a-z][\w\s,'-]*)/i,
    type: 'explicit_profile',
    baseConfidence: 0.88,
    buildContent: (m) => `User works at ${clean(m[1])}.`,
  },
  {
    regex:
      /\bi(?:'m| am) an? ([a-z][\w\s-]*?(?:engineer|developer|doctor|lawyer|teacher|nurse|designer|manager|founder|writer|artist|student))\b/i,
    type: 'explicit_profile',
    baseConfidence: 0.85,
    buildContent: (m) => `User is a ${clean(m[1])}.`,
  },
  {
    regex: /\bi (?:don'?t like|dislike|hate) ([a-z][\w\s,'-]*)/i,
    type: 'learned_preference',
    baseConfidence: 0.85,
    buildContent: (m) => `User dislikes ${clean(m[1])}.`,
  },
  {
    regex: /\bi (?:prefer|like|love|enjoy) ([a-z][\w\s,'-]*)/i,
    type: 'learned_preference',
    baseConfidence: 0.85,
    buildContent: (m) => `User prefers ${clean(m[1])}.`,
  },
  {
    regex: /\bi always ([a-z][\w\s,'-]*)/i,
    type: 'learned_preference',
    baseConfidence: 0.8,
    buildContent: (m) => `User always ${clean(m[1])}.`,
  },
  {
    regex: /\bi(?:'m| am) (?:currently )?(researching|working on|writing|building|studying) ([a-z][\w\s,'-]*)/i,
    type: 'conversation_memory',
    baseConfidence: 0.6,
    buildContent: (m) => `User is ${m[1]} ${clean(m[2])}.`,
  },
]

/**
 * Pure, deterministic, keyword/pattern-based extraction — no AI provider
 * call. Runs on a single message's text and never automatically saves
 * anything (see MemoryApprovalPanel for the human-approval step). A
 * sensitive-topic match anywhere in the source text suppresses every
 * candidate from that message, not just the matched capture.
 */
export function detectMemoryCandidates(text: string, sourceConversationId: string): MemoryCandidate[] {
  if (containsSensitiveTopic(text)) return []

  const candidates: MemoryCandidate[] = []
  const seen = new Set<string>()

  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text)
    if (!match) continue

    const confidence = scoreMemoryConfidence(text, pattern.baseConfidence)
    if (confidence < MIN_CONFIDENCE) continue

    const content = pattern.buildContent(match)
    if (seen.has(content)) continue
    seen.add(content)

    candidates.push({ content, type: pattern.type, confidence, sourceConversationId })
  }

  return candidates
}
