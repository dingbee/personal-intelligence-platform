import type { NovaContext } from '@/modules/intelligence/context/types'
import { formatNovaContext } from '@/modules/intelligence/context/contextFormatter'
import { buildPersonalityPrompt } from '@/modules/intelligence/personality/novaPersonality'
import { describeResponseStrategy } from '@/modules/intelligence/strategy/responseStrategy'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

/**
 * UX-6 Phase 4 / UX-14.2 Planner Integration: assembles the NEW
 * intelligence layer's prompt fragment — personality + prioritized
 * situational context + response-style guidance. Purely additive text
 * appended to buildSystemPrompt's output by AIService, the same way
 * <knowledge_connections>/<personal_context> were appended in UX-5.2.
 * Never touches retrieval, provider selection, streaming, or the rag-chat
 * prompt template itself.
 *
 * Style guidance now comes from the Reasoning Planner's own
 * responseStrategy classification (already computed once per turn by
 * AIService, the same value the Reasoning Trace UI displays) via
 * describeResponseStrategy's closed-set, developer-authored descriptions
 * — not the raw plan, not user text, not suggestedCommandIds. This
 * replaces the narrower, independent inferResponseStyleHint(userQuery)
 * path (UX-6), which only ever recognized 3 buckets and never knew about
 * decision/comparison/planning/tutorial/executive_summary requests the
 * planner already distinguishes.
 */
export function buildNovaContextPrompt(context: NovaContext, responseStrategy: ResponseStrategyType): string {
  const personality = buildPersonalityPrompt()
  const situational = formatNovaContext(context)
  const styleGuidance = describeResponseStrategy(responseStrategy)

  const sections = [personality, situational ? `Current context:\n${situational}` : null, styleGuidance]
  return sections.filter((section): section is string => Boolean(section)).join('\n\n')
}
