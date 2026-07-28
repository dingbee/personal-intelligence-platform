import type { Command } from '@/modules/commands/types'

export const openSearchCommand: Command = {
  id: 'search-open',
  title: 'Search library',
  description: 'Semantic search across documents and past conversations',
  icon: '🔍',
  category: 'search',
  featured: true,
  execute: (_context, actions) => actions.navigate('/search'),
}

/**
 * Generated per-render once the user has typed something — semantic
 * search needs an embedding call per query, so this is a deliberate
 * action (not live-as-you-type filtering). Navigates to the existing
 * Search page with `q` set; SearchPage runs it once on mount (see its
 * query-param effect) through its own useSearch — same code path as
 * typing into that page directly.
 */
export function buildSearchQueryCommand(query: string): Command {
  return {
    id: 'search-query',
    title: `Search library for "${query}"`,
    icon: '🔍',
    category: 'search',
    execute: (_context, actions) => actions.navigate(`/search?q=${encodeURIComponent(query)}`),
  }
}
