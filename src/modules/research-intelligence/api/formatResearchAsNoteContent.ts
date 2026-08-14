import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'
import { collectDistinctSources } from '@/modules/research-intelligence/api/formatResearchForSynthesis'

const GAP_REASON_LABELS: Record<string, string> = {
  insufficient_evidence: 'Insufficient evidence',
  conflicting_findings: 'Conflicting findings',
  methodological_limitation: 'Methodological limitation',
  missing_variable: 'Missing variable',
  unanswered_question: 'Unanswered question',
  outdated_evidence: 'Outdated evidence',
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  agrees_with: 'agrees with',
  differs_from: 'differs from',
  provides_additional_evidence: 'provides additional evidence for',
  uses_different_methodology: 'uses a different methodology than',
  cannot_be_directly_compared: 'cannot be directly compared with',
}

/**
 * Research Intelligence — pure formatter turning a completed
 * ResearchInvestigation into the plain-text content saveResearchToNote.ts
 * persists. Kept separate from persistence so it's independently
 * testable and so the "what does a saved research result actually
 * contain" question has one deterministic answer, not one hidden inside
 * a Supabase call.
 */
export function formatResearchAsNoteContent(investigation: ResearchInvestigation): string {
  const sources = collectDistinctSources(investigation)
  const lines: string[] = [`Research question: ${investigation.question}`]

  if (investigation.scope) lines.push(`Scope: ${investigation.scope}`)
  if (investigation.context) lines.push(`Context: ${investigation.context}`)
  lines.push('')

  if (investigation.status === 'declined' || investigation.status === 'failed') {
    lines.push(investigation.declineReason ?? 'This research question could not be investigated.')
    return lines.join('\n')
  }

  if (investigation.keyFindings.length > 0) {
    lines.push('Key findings:')
    for (const finding of investigation.keyFindings) lines.push(`- ${finding}`)
    lines.push('')
  }

  if (investigation.synthesis) {
    lines.push('Synthesis:')
    lines.push(investigation.synthesis)
    lines.push('')
  } else if (investigation.synthesisFailed) {
    lines.push('Synthesis: could not be generated. The evidence and observations gathered below are still shown as-is.')
    lines.push('')
  }

  if (sources.length > 0) {
    lines.push('Sources consulted:')
    for (const source of sources) lines.push(`- [${source.type === 'document' ? 'Document' : source.type === 'note' ? 'Note' : 'Dataset analysis'}] ${source.title}`)
    lines.push('')
  }

  if (investigation.comparisons.length > 0) {
    lines.push('Cross-source comparisons:')
    for (const c of investigation.comparisons) {
      const titles = c.sourceIds.map((id) => sources.find((s) => s.id === id)?.title ?? id)
      lines.push(`- ${titles.join(' ')} — ${RELATIONSHIP_LABELS[c.relationship] ?? c.relationship}: ${c.description}`)
    }
    lines.push('')
  }

  if (investigation.limitations) {
    lines.push('Limitations:')
    lines.push(investigation.limitations)
    lines.push('')
  }

  if (investigation.gaps.length > 0) {
    lines.push('Research gaps:')
    for (const gap of investigation.gaps) lines.push(`- (${GAP_REASON_LABELS[gap.reason] ?? gap.reason}) ${gap.description}`)
    lines.push('')
  }

  if (investigation.followUpQuestions.length > 0) {
    lines.push('Follow-up questions:')
    for (const q of investigation.followUpQuestions) lines.push(`- ${q}`)
    lines.push('')
  }

  if (investigation.stepLimitReached) lines.push('Note: investigation depth was limited by the research step budget.')

  return lines.join('\n').trim()
}
