import type { ExplainSummary } from '@/modules/intelligence/explain/computeExplainSummary'

/**
 * UX-7 Phase 5 — native <details>, no new modal/primitive; collapsed by
 * default so it never competes with the answer itself.
 *
 * Phase 5A — deliberately does NOT render `summary.model` (the provider's
 * raw model id, e.g. "claude-sonnet-5"): ARRIYIA users must never see
 * which AI provider/model answered. `ExplainSummary.model` itself is left
 * in place (still used by admin-only observability) — this component
 * just never reads that field.
 */
export function ExplainAnswerPanel({ summary }: { summary: ExplainSummary }) {
  return (
    <details className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
      <summary className="cursor-pointer select-none hover:text-[var(--color-ink)]">Why did ARRIYIA answer this?</summary>
      <ul className="mt-2 flex flex-col gap-1 rounded-control bg-[var(--surface-inset)] p-3 shadow-inset">
        <li>Documents used: {summary.documentsUsed}</li>
        <li>
          Knowledge graph:{' '}
          {summary.knowledgeGraphUsed
            ? `${summary.graphNodeCount} connection${summary.graphNodeCount === 1 ? '' : 's'}`
            : 'Not used'}
        </li>
        <li>Memories: {summary.memoriesUsed ? `${summary.memoryCount} used` : 'Not used'}</li>
        <li>Workspace: {summary.workspaceName ?? 'All'}</li>
        <li>Conversation: {summary.isContinuation ? 'Continuing previous topic' : 'New topic'}</li>
        <li>Response style: {summary.responseStyle}</li>
      </ul>
    </details>
  )
}
