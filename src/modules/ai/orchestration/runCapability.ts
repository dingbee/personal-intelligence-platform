import { getActivePrompt } from '@/modules/core/prompts/registry'
import { renderPromptTemplate } from '@/modules/core/prompts/renderPromptTemplate'
import { getChatProvider, DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { streamChatCompletion, type StreamChatCompletionResult } from '@/modules/ai/orchestration/streamChatCompletion'

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
}

/**
 * One-shot capability execution (Summarize, Flashcards, ...) — the
 * non-conversational counterpart to AIService.sendMessage. Same rule
 * applies: resolves the prompt template and provider through the
 * registries, never calls a provider directly. A capability with no
 * registered PromptTemplate simply can't run yet — that's the point of
 * keeping capabilities and their execution decoupled.
 */
export async function runCapability(params: RunCapabilityParams): Promise<StreamChatCompletionResult> {
  const { capabilityId, variables, userId, workspaceId, providerId = DEFAULT_CHAT_PROVIDER_ID, requestedProviderId, knowledgeContext } = params

  const template = getActivePrompt(capabilityId)
  if (!template) throw new Error(`No active prompt template for capability "${capabilityId}"`)

  let system = renderPromptTemplate(template.template, variables)
  if (knowledgeContext) {
    system += `\n\n<knowledge_connections>\n${knowledgeContext}\n</knowledge_connections>`
  }

  return streamChatCompletion({
    provider: getChatProvider(providerId),
    messages: [{ role: 'user', content: 'Generate the output now.' }],
    system,
    userId,
    workspaceId,
    feature: capabilityId,
    requestedProvider: requestedProviderId,
  })
}
