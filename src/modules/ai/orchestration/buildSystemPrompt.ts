import { getActivePrompt } from '@/modules/core/prompts/registry'
import { renderPromptTemplate } from '@/modules/core/prompts/renderPromptTemplate'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

/**
 * Fills the active 'chat' PromptTemplate's {{context}} placeholder with
 * retrieved chunks, then optionally appends a separate
 * <knowledge_connections> block (Phase 9D) with AI-extracted concepts,
 * entities, and relationships from the same retrieved documents.
 *
 * The rag-chat@1.0 template itself is untouched by this — graphContext is
 * appended to the rendered result, not woven into {{context}}, so the
 * existing prompt contract (and its behavior when graphContext is absent)
 * stays exactly as it was before Phase 9D.
 */
export function buildSystemPrompt(matches: VectorMatch[], graphContext?: string | null): string {
  const template = getActivePrompt('chat')
  if (!template) throw new Error('No active prompt template for the "chat" capability — is coreModule registered?')

  const context =
    matches.length > 0
      ? matches.map((match, i) => `[${i + 1}] ${match.content}`).join('\n\n')
      : '(No relevant content found in the user\'s library.)'

  const base = renderPromptTemplate(template.template, { context })
  if (!graphContext) return base

  return `${base}\n\n<knowledge_connections>\n${graphContext}\n</knowledge_connections>`
}
