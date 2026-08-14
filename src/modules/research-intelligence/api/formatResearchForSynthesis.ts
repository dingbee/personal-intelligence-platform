import type { ResearchInvestigation, ResearchSource } from '@/modules/research-intelligence/researchInvestigation'

/** De-duplicated, first-seen-order list of every distinct source referenced anywhere in the investigation — the numbered list the synthesis prompt cites sources by, and the allow-list runResearchInvestigation.ts validates the synthesis response's comparisons against (see parseResearchSynthesisResponse.ts). */
export function collectDistinctSources(investigation: ResearchInvestigation): ResearchSource[] {
  const seen = new Set<string>()
  const sources: ResearchSource[] = []
  for (const step of investigation.steps) {
    for (const item of step.evidence) {
      const key = `${item.source.type}:${item.source.id}`
      if (seen.has(key)) continue
      seen.add(key)
      sources.push(item.source)
    }
  }
  return sources
}

/**
 * Research Intelligence — formats a (possibly still in-progress)
 * investigation into the one text block the final research-synthesis
 * capability reads. Same discipline as Analysis Intelligence's
 * formatInvestigationForSynthesis.ts: the synthesis model sees only
 * what was actually gathered — real queries, real evidence excerpts
 * with real source titles, real observations with their citations, and
 * (for any dataset_investigation step) the real Analysis Intelligence
 * synthesis and its own verified observations. Nothing here is invented
 * on the model's behalf.
 */
export function formatResearchForSynthesis(investigation: ResearchInvestigation): string {
  const sources = collectDistinctSources(investigation)
  const sourceIndex = new Map(sources.map((s, i) => [`${s.type}:${s.id}`, i + 1]))

  const stepsText = investigation.steps
    .map((step) => {
      const lines: string[] = [`Step ${step.index + 1} — ${step.purpose} (${step.kind === 'dataset_investigation' ? 'dataset analysis' : 'evidence search'}: "${step.query}")`]

      if (step.evidence.length === 0) {
        lines.push('  No evidence found for this step.')
      } else {
        for (const item of step.evidence) {
          const num = sourceIndex.get(`${item.source.type}:${item.source.id}`)
          lines.push(`  [Source ${num}: ${item.source.title}] ${item.excerpt}`)
        }
      }

      if (step.observations.length > 0) {
        lines.push('  Observations:')
        for (const obs of step.observations) lines.push(`    - ${obs.statement}`)
      }

      if (step.kind === 'dataset_investigation' && step.datasetInvestigation) {
        const inv = step.datasetInvestigation
        lines.push(`  Dataset investigation status: ${inv.status}${inv.stepLimitReached ? ' (step limit reached)' : ''}`)
        if (inv.synthesis) lines.push(`  Dataset investigation synthesis: ${inv.synthesis}`)
      }

      return lines.join('\n')
    })
    .join('\n\n')

  const sourcesText = sources.length === 0 ? '(none)' : sources.map((s, i) => `${i + 1}. [${s.type}] ${s.title}`).join('\n')

  return (
    `Research question: ${investigation.question}\n` +
    `Scope: ${investigation.scope ?? '(not specified)'}\n` +
    `Context: ${investigation.context ?? '(not specified)'}\n\n` +
    `Distinct sources consulted:\n${sourcesText}\n\n` +
    `Investigation steps:\n${stepsText || '(no steps completed)'}`
  )
}
