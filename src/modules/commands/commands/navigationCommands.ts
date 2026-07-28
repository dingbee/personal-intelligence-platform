import type { Command } from '@/modules/commands/types'

/** Plain page navigation — no context needed, always available. */
export const navigationCommands: Command[] = [
  {
    id: 'nav-library',
    title: 'Find documents',
    description: 'Browse your library',
    icon: '📄',
    category: 'navigation',
    featured: true,
    execute: (_context, actions) => actions.navigate('/library'),
  },
  {
    id: 'nav-knowledge',
    title: 'Open Knowledge dashboard',
    description: 'Notes, highlights, and AI-extracted insights',
    icon: '🧭',
    category: 'navigation',
    execute: (_context, actions) => actions.navigate('/knowledge'),
  },
  {
    id: 'nav-knowledge-graph',
    title: 'Open Knowledge graph',
    icon: '🕸️',
    category: 'navigation',
    execute: (_context, actions) => actions.navigate('/knowledge/graph'),
  },
  {
    id: 'nav-knowledge-explorer',
    title: 'Open Knowledge explorer',
    icon: '🔎',
    category: 'navigation',
    execute: (_context, actions) => actions.navigate('/knowledge/explorer'),
  },
  {
    id: 'nav-notes',
    title: 'Open Notes',
    icon: '🗒️',
    category: 'navigation',
    execute: (_context, actions) => actions.navigate('/notes'),
  },
  {
    id: 'nav-chat',
    title: 'Open Chat',
    icon: '💬',
    category: 'navigation',
    execute: (_context, actions) => actions.navigate('/chat'),
  },
  {
    id: 'nav-settings',
    title: 'Open settings',
    icon: '⚙',
    category: 'settings',
    featured: true,
    execute: (_context, actions) => actions.navigate('/settings'),
  },
  {
    id: 'nav-ai-health',
    title: 'Open AI health',
    description: 'Provider status and request history',
    icon: '📈',
    category: 'settings',
    execute: (_context, actions) => actions.navigate('/settings/ai-health'),
  },
]
