import type { DocumentIntelligence } from '@/shared/types/database'

/**
 * Multimodal Intelligence v2 — the honest interpretation of "convert into
 * Notes + Knowledge Nodes + Tasks" (see docs/multimodal-intelligence-v2-discovery.md
 * §9): knowledge nodes already exist via runKnowledgeExtractionFromContent;
 * this builds the Note half, rendering extracted tasks as a real markdown
 * checklist rather than inventing a first-class Task entity this codebase
 * doesn't have. Pure/testable — the note-creation call site just persists
 * whatever this returns.
 */
export function buildStructuredNoteContent(params: { description: string; documentIntelligence: DocumentIntelligence | null }): string {
  const sections: string[] = [params.description]
  const di = params.documentIntelligence

  if (di) {
    if (di.dates.length > 0) {
      sections.push(['## Dates', ...di.dates.map((d) => `- **${d.label}:** ${d.date}`)].join('\n'))
    }
    if (di.decisions.length > 0) {
      sections.push(['## Decisions', ...di.decisions.map((decision) => `- ${decision}`)].join('\n'))
    }
    if (di.tasks.length > 0) {
      sections.push(['## Tasks', ...di.tasks.map((task) => `- [ ] ${task.description}${task.owner ? ` (${task.owner})` : ''}`)].join('\n'))
    }
  }

  return sections.join('\n\n')
}
