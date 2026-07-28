import type { Command } from '@/modules/commands/types'

/** Title carries "Manage memories", description carries "Open memory settings" — both phrases from the UX-5.3A brief on one command, since there's only one route to open. */
export const manageMemoriesCommand: Command = {
  id: 'memory-manage',
  title: 'Manage memories',
  description: 'Open memory settings',
  icon: '💭',
  category: 'memory',
  featured: true,
  execute: (_context, actions) => actions.navigate('/settings/memory'),
}

/** Same reasoning as manageMemoriesCommand above: "Review memory suggestions" and "Open memory approvals" both describe opening the one settings surface (MemoryApprovalPanel lives on /settings/memory) — one command, not two competing routes. */
export const reviewMemorySuggestionsCommand: Command = {
  id: 'memory-review-suggestions',
  title: 'Review memory suggestions',
  description: 'Open memory approvals',
  icon: '🔎',
  category: 'memory',
  execute: (_context, actions) => actions.navigate('/settings/memory'),
}
