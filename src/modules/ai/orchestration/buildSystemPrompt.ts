import { promptRegistry } from '@/modules/core/prompts/registry'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

/** Fills the registered 'rag-chat' PromptTemplate's {{context}} placeholder with retrieved chunks. */
export function buildSystemPrompt(matches: VectorMatch[]): string {
  const template = promptRegistry.get('rag-chat')
  if (!template) throw new Error('Missing "rag-chat" prompt template — is coreModule registered?')

  const context =
    matches.length > 0
      ? matches.map((match, i) => `[${i + 1}] ${match.content}`).join('\n\n')
      : '(No relevant content found in the user\'s library.)'

  return template.template.replace('{{context}}', context)
}
