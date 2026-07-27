import { getActivePrompt } from '@/modules/core/prompts/registry'
import { renderPromptTemplate } from '@/modules/core/prompts/renderPromptTemplate'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

/** Fills the active 'chat' PromptTemplate's {{context}} placeholder with retrieved chunks. */
export function buildSystemPrompt(matches: VectorMatch[]): string {
  const template = getActivePrompt('chat')
  if (!template) throw new Error('No active prompt template for the "chat" capability — is coreModule registered?')

  const context =
    matches.length > 0
      ? matches.map((match, i) => `[${i + 1}] ${match.content}`).join('\n\n')
      : '(No relevant content found in the user\'s library.)'

  return renderPromptTemplate(template.template, { context })
}
