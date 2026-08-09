import type { Command } from '@/modules/commands/types'

export const askNovaCommand: Command = {
  id: 'ai-ask-nova',
  title: 'Ask my knowledge',
  description: 'Start a conversation grounded in your documents',
  icon: '🧠',
  category: 'ai',
  featured: true,
  execute: (_context, actions) => actions.navigate('/chat'),
}

/**
 * Only surfaced once the user has actually typed a question — "Ask NOVA"
 * with no query isn't a meaningful action, so this is generated per-render
 * by the Command Bar rather than registered as a static command. Reuses
 * the exact same chat pipeline as typing into Chat directly: creates a
 * conversation and hands off to ChatPage's own send flow (see its
 * initialQuery effect) — no AI orchestration happens here.
 */
export function buildAskNovaQueryCommand(query: string): Command {
  return {
    id: 'ai-ask-nova-query',
    title: `Ask ARRIYIA: "${query}"`,
    description: 'Grounded in your documents and knowledge graph',
    icon: '🧠',
    category: 'ai',
    execute: async (_context, actions) => {
      await actions.createConversationWithQuery(query)
    },
  }
}
