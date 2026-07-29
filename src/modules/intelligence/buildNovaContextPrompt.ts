import type { NovaContext } from '@/modules/intelligence/context/types'
import { formatNovaContext } from '@/modules/intelligence/context/contextFormatter'
import { buildPersonalityPrompt } from '@/modules/intelligence/personality/novaPersonality'
import { buildResponseStyleGuidance, inferResponseStyleHint } from '@/modules/intelligence/personality/responseStyle'

/**
 * UX-6 Phase 4: assembles the NEW intelligence layer's prompt fragment —
 * personality + prioritized situational context + response-style guidance.
 * Purely additive text appended to buildSystemPrompt's output by AIService,
 * the same way <knowledge_connections>/<personal_context> were appended in
 * UX-5.2. Never touches retrieval, provider selection, streaming, or the
 * rag-chat prompt template itself.
 */
export function buildNovaContextPrompt(context: NovaContext, userQuery: string): string {
  const personality = buildPersonalityPrompt()
  const situational = formatNovaContext(context)
  const styleGuidance = buildResponseStyleGuidance(inferResponseStyleHint(userQuery))

  const sections = [personality, situational ? `Current context:\n${situational}` : null, styleGuidance]
  return sections.filter((section): section is string => Boolean(section)).join('\n\n')
}
