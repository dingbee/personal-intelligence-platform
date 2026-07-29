import type { Command } from '@/modules/commands/types'

/** Same per-instance-command pattern as buildContinueReadingCommand (readerCommands.ts) — generated per-render so the title can name the actual document, not a generic label. */
export function buildOpenDocumentDetailCommand(documentId: string, title: string): Command {
  return {
    id: `knowledge-open-document-${documentId}`,
    title: `Open ${title}`,
    icon: '📄',
    category: 'ai',
    execute: (_context, actions) => actions.navigate(`/library/${documentId}`),
  }
}

export function buildOpenReaderCommand(documentId: string, title: string, label = `Read ${title}`): Command {
  return {
    id: `knowledge-open-reader-${documentId}`,
    title: label,
    icon: '📖',
    category: 'ai',
    execute: (_context, actions) => actions.navigate(`/library/${documentId}/read`),
  }
}
