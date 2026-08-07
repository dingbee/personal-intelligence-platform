import type { AssetAnalysis } from '@/shared/types/database'

/**
 * PIP Stabilization v1 (P0) — the prompt-context serialization of an
 * analyzed image, distinct from buildStructuredNoteContent (which
 * produces markdown for a saved Note): this is a flat evidence block for
 * retrieveAssetContext to feed into the chat system prompt, the same role
 * `match.content` plays for a document chunk. Never fabricates content —
 * every section is omitted, not guessed, when the analysis didn't produce
 * it, and confidence caveats are surfaced explicitly rather than silently
 * dropped, so the model never treats a low-confidence read as settled fact.
 */
export function buildAssetContextContent(title: string, metadata: AssetAnalysis): string {
  const lines: string[] = [`Image: "${title}"`, metadata.description]

  if (metadata.extractedText) {
    lines.push(`Visible text${metadata.detectedLanguage ? ` (${metadata.detectedLanguage})` : ''}: ${metadata.extractedText}`)
  }

  const di = metadata.documentIntelligence
  if (di) {
    if (di.dates.length > 0) lines.push(`Dates mentioned: ${di.dates.map((d) => `${d.label} — ${d.date}`).join('; ')}`)
    if (di.decisions.length > 0) lines.push(`Decisions recorded: ${di.decisions.join('; ')}`)
    if (di.tasks.length > 0) {
      lines.push(`Tasks recorded: ${di.tasks.map((t) => `${t.description}${t.owner ? ` (${t.owner})` : ''}`).join('; ')}`)
    }
  }

  const lowConfidenceParts: string[] = []
  if (metadata.confidence) {
    if (metadata.confidence.text !== null && metadata.confidence.text < 0.5) lowConfidenceParts.push('the transcribed text')
    if (metadata.confidence.entities !== null && metadata.confidence.entities < 0.5) lowConfidenceParts.push('the identified entities')
    if (metadata.confidence.relationships !== null && metadata.confidence.relationships < 0.5) lowConfidenceParts.push('the identified relationships')
  }
  if (lowConfidenceParts.length > 0) {
    lines.push(`Note: the model was not fully confident about ${lowConfidenceParts.join(', ')} in this image — say so if asked about those specifics rather than stating them as certain.`)
  }

  return lines.join('\n')
}
