import type { Command } from '@/modules/commands/types'

/** UX-8 Phase 6/10 — thin wrapper around the existing /knowledge/explorer route, same pattern as every other static command. */
export const openKnowledgeGraphCommand: Command = {
  id: 'knowledge-explore',
  title: 'Explore knowledge graph',
  description: 'See concepts, entities, and how they connect',
  icon: '🕸️',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/knowledge/explorer'),
}
