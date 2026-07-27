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
  const { capabilityId, variables, userId, workspaceId, providerId = DEFAULT_CHAT_PROVIDER_ID } = params

  const template = getActivePrompt(capabilityId)
  if (!template) throw new Error(`No active prompt template for capability "${capabilityId}"`)

  const system = renderPromptTemplate(template.template, variables)

  return streamChatCompletion({
    provider: getChatProvider(providerId),
    messages: [{ role: 'user', content: 'Generate the output now.' }],
    system,
    userId,
    workspaceId,
    feature: capabilityId,
  })
}
