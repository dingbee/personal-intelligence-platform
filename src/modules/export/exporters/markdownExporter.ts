import type { ExportContent } from '@/modules/export/types'

/**
 * Pure, synchronous — no dynamic import needed, unlike the PDF/Word
 * exporters, since markdown is plain text this app can already build
 * without any library (mirrors `buildKnowledgeExportMarkdown`'s own
 * generalized shape, extended to any object type via `ExportContent`
 * rather than being specific to Knowledge Node evidence).
 */
export function exportContentToMarkdown(content: ExportContent): string {
  const lines: string[] = [`# ${content.title}`]

  if (content.subtitle) {
    lines.push('', `_${content.subtitle}_`)
  }

  for (const section of content.sections) {
    lines.push('')
    if (section.heading) {
      lines.push(`## ${section.heading}`, '')
    }
    for (const entry of section.body) {
      lines.push(section.format === 'list' ? `- ${entry}` : entry)
    }
  }

  return lines.join('\n')
}
