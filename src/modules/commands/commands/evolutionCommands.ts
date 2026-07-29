import type { Command } from '@/modules/commands/types'

/**
 * UX-13 Evolution Commands — all six navigate to the same page (/evolution):
 * one unified Knowledge Evolution view, not separate sub-routes, the same
 * reasoning UX-11's dashboardCommands already established for its four
 * dashboard-opening commands. Distinct commands still matter for Command
 * Bar discoverability.
 */
export const reviewWorkspaceEvolutionCommand: Command = {
  id: 'evolution-review-workspace',
  title: 'Review Workspace Evolution',
  description: 'See how this workspace has grown and changed',
  icon: '📈',
  category: 'ai',
  featured: true,
  execute: (_context, actions) => actions.navigate('/evolution'),
}

export const reviewKnowledgeHealthCommand: Command = {
  id: 'evolution-review-health',
  title: 'Review Knowledge Health',
  description: 'Orphaned concepts, duplicates, and stale documents',
  icon: '🩺',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/evolution'),
}

export const reviewConceptGrowthCommand: Command = {
  id: 'evolution-review-concepts',
  title: 'Review Concept Growth',
  description: 'Which concepts are emerging, growing, or going dormant',
  icon: '🌱',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/evolution'),
}

export const reviewTimelineCommand: Command = {
  id: 'evolution-review-timeline',
  title: 'Review Timeline',
  description: 'A chronological view of how your knowledge formed',
  icon: '🕰️',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/evolution'),
}

export const reviewKnowledgeGapsCommand: Command = {
  id: 'evolution-review-gaps',
  title: 'Review Knowledge Gaps',
  description: 'What knowledge is missing or being neglected',
  icon: '🕳️',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/evolution'),
}

export const forecastWorkspaceCommand: Command = {
  id: 'evolution-forecast-workspace',
  title: 'Forecast Workspace',
  description: 'Deterministic predictions about where this workspace is headed',
  icon: '🔮',
  category: 'ai',
  execute: (_context, actions) => actions.navigate('/evolution'),
}
