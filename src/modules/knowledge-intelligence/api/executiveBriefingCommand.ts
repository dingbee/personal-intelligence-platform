/**
 * UX-13 roadmap Phase 5 — Natural Language Knowledge Commands v1. Pure,
 * deterministic pattern recognition (not LLM intent classification) for
 * exactly one command shape: "create/generate/write a(n) (executive)
 * briefing on/about/for <topic>". Same deterministic-vs-LLM split used
 * throughout UX-13 (matchKnownConcepts, computeKnowledgeConfidence): the
 * LLM writes the briefing itself, but recognizing that the user asked for
 * one is fast, free, and predictable — no reason to spend a model call
 * deciding that.
 */
const COMMAND_PATTERN = /^(?:create|generate|write)\s+(?:an?\s+)?(?:executive\s+)?briefing\s+(?:on|about|for)\s+(.+?)[.!?]*$/i

export interface ExecutiveBriefingCommand {
  topic: string
}

export function parseExecutiveBriefingCommand(text: string): ExecutiveBriefingCommand | null {
  const match = text.trim().match(COMMAND_PATTERN)
  const captured = match?.[1]
  if (!captured) return null
  const topic = captured.trim()
  if (!topic) return null
  return { topic }
}
