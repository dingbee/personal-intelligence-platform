import type { Command } from '@/modules/commands/types'

export const quickCaptureCommand: Command = {
  id: 'capture-quick',
  title: 'Quick capture',
  description: 'Save a file, note, or link — it goes to the right place automatically.',
  icon: '📥',
  category: 'capture',
  featured: true,
  execute: (_context, actions) => {
    actions.openQuickCapture()
  },
}
