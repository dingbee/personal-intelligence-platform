import type { Command } from '@/modules/commands/types'

/**
 * UX-11 Phase 9 — all four navigate to the same page: the Executive
 * Dashboard is one unified view (Score/Growth/Attention/Insights all
 * visible together), not split across sub-routes, so there's no separate
 * destination per command — same reasoning as manageMemoriesCommand/
 * reviewMemorySuggestionsCommand already sharing one route. Distinct
 * commands still matter for Command Bar discoverability (searching
 * "attention" or "score" should surface this page).
 */
export const openIntelligenceDashboardCommand: Command = {
  id: 'dashboard-open',
  title: 'Open Intelligence Dashboard',
  description: 'Your personal intelligence command center',
  icon: '🧠',
  category: 'ai',
  featured: true,
  execute: (_context, actions) => actions.navigate('/dashboard'),
}

export const showKnowledgeGrowthCommand: Command = {
  id: 'dashboard-growth',
  title: 'Show Knowledge Growth',
  description: 'Documents, concepts, and connections over time',
  icon: '📈',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/dashboard'),
}

export const showAttentionItemsCommand: Command = {
  id: 'dashboard-attention',
  title: 'Show Attention Items',
  description: 'What needs your attention right now',
  icon: '⚠️',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/dashboard'),
}

export const explainIntelligenceScoreCommand: Command = {
  id: 'dashboard-explain-score',
  title: 'Explain My Intelligence Score',
  description: 'See how your Personal Intelligence Index is calculated',
  icon: '🔎',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/dashboard'),
}
