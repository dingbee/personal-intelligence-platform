import type { Command } from '@/modules/commands/types'

export const createNoteCommand: Command = {
  id: 'notes-create',
  title: 'Create note',
  icon: '📝',
  category: 'notes',
  featured: true,
  execute: async (_context, actions) => {
    const note = await actions.createNote()
    actions.navigate(`/notes/${note.id}`)
  },
}
