import { getActivePrompt } from '@/modules/core/prompts/registry'
import { renderPromptTemplate } from '@/modules/core/prompts/renderPromptTemplate'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { getChatProvider, DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { streamChatCompletion, type StreamChatCompletionResult } from '@/modules/ai/orchestration/streamChatCompletion'
import { hasFeature } from '@/modules/plans/api/plans'

export interface RunCapabilityParams {
  /** Must match a capability registered via registerPlatformModule, e.g. 'summarize', 'flashcards'. */
  capabilityId: string
  variables: Record<string, string>
  userId: string
  workspaceId: string | null
  providerId?: string
  /** Phase 8C: the caller's chain[0], for fallback logging — pass it whenever this call is one candidate in a runWithFallback loop, even when it equals `providerId`. */
  requestedProviderId?: string
  /**
   * UX-13 Unified Intelligence Pipeline — the same <knowledge_connections>
   * block AIService.sendMessage appends to the chat prompt (see
   * buildSystemPrompt), passed through so a one-shot capability like
   * Summarize can be grounded in the same canonical extracted knowledge
   * Chat uses, instead of forming its own independent interpretation of
   * the raw content. Omit to leave a capability's prompt exactly as before.
   */
  knowledgeContext?: string | null
  /**
   * UX-13.10.1 — same <spreadsheet_analysis> block buildSystemPrompt
   * appends for Chat, so the Reader's spreadsheet Summary panel is
   * grounded in the exact same precomputed figures Chat answers from —
   * one computed analysis object feeding both surfaces, never two
   * independent interpretations of the same sheet.
   */
  spreadsheetContext?: string | null
  /** Operation Budget Foundation — passed straight through to streamChatCompletion so this call's ai_requests row is grouped with the rest of its intelligence operation. */
  operationId?: string | null
  operationType?: string | null
}

/**
 * One-shot capability execution (Summarize, Flashcards, ...) — the
 * non-conversational counterpart to AIService.sendMessage. Same rule
 * applies: resolves the prompt template and provider through the
 * registries, never calls a provider directly. A capability with no
 * registered PromptTemplate simply can't run yet — that's the point of
 * keeping capabilities and their execution decoupled.
 *
 * Phase P0 Pro Intelligence Foundation — if the capability declares a
 * `requiredFeature` (see AICapability), entitlement is checked here
 * before any prompt/provider resolution happens, so a future gated
 * capability (Research/Planning/Deep Academic Intelligence) is denied in
 * one place regardless of which UI surface called it. Every capability
 * registered today has no `requiredFeature`, so this is a no-op for all
 * existing behavior.
 */
export async function runCapability(params: RunCapabilityParams): Promise<StreamChatCompletionResult> {
  const { capabilityId, variables, userId, workspaceId, providerId = DEFAULT_CHAT_PROVIDER_ID, requestedProviderId, knowledgeContext, spreadsheetContext, operationId, operationType } = params

  const capability = capabilityRegistry.get(capabilityId)
  if (capability?.requiredFeature && !(await hasFeature(userId, capability.requiredFeature))) {
    throw new Error(`${capability.label} requires an upgraded plan.`)
  }

  const template = getActivePrompt(capabilityId)
  if (!template) throw new Error(`No active prompt template for capability "${capabilityId}"`)

  let system = renderPromptTemplate(template.template, variables)
  if (knowledgeContext) {
    system += `\n\n<knowledge_connections>\n${knowledgeContext}\n</knowledge_connections>`
  }
  if (spreadsheetContext) {
    system += `\n\n<spreadsheet_analysis>\n${spreadsheetContext}\n</spreadsheet_analysis>`
  }

  return streamChatCompletion({
    provider: getChatProvider(providerId),
    messages: [{ role: 'user', content: 'Generate the output now.' }],
    system,
    userId,
    workspaceId,
    feature: capabilityId,
    requestedProvider: requestedProviderId,
    operationId,
    operationType,
  })
}
