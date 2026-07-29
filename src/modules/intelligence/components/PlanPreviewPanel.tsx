import type { ReasoningTrace } from '@/modules/intelligence/planner/reasoningTrace'
import { buildPlanPreview } from '@/modules/intelligence/planner/planPreview'

const CONTEXT_SOURCE_LABEL: Record<ReasoningTrace['selectedContext']['included'][number], string> = {
  documents: 'Documents',
  reading_progress: 'Reading progress',
  notes: 'Notes',
  flashcards: 'Flashcards',
  memory: 'Memory',
  knowledge_graph: 'Knowledge graph',
  recent_conversations: 'Recent conversations',
  workspace_overview: 'Workspace overview',
}

/**
 * UX-12 Phase 8/10 — collapsible Plan Preview, matching the brief's own
 * "Here's how I'll approach this" example. Pure metadata rendering — never
 * exposes the model's actual chain-of-thought, just the already-decided
 * ReasoningPlan/ContextSelection formatted for display. Reuses the same
 * <details> collapsible pattern already used throughout Chat/Reader/
 * Graph Intelligence panels.
 */
export function PlanPreviewPanel({ trace }: { trace: ReasoningTrace }) {
  const steps = buildPlanPreview(trace.planner)

  return (
    <details className="text-xs text-[var(--color-ink-muted)]">
      <summary className="cursor-pointer select-none hover:text-[var(--color-ink)]">Here's how I'll approach this</summary>
      <div className="mt-2 flex flex-col gap-2">
        {trace.selectedContext.included.length > 0 && (
          <p>
            <span className="font-medium text-[var(--color-ink)]">Context used:</span>{' '}
            {trace.selectedContext.included.map((source) => CONTEXT_SOURCE_LABEL[source]).join(', ')}
          </p>
        )}
        <ol className="flex flex-col gap-0.5">
          {steps.map((step) => (
            <li key={step.order}>
              {step.order}. {step.description}
            </li>
          ))}
        </ol>
      </div>
    </details>
  )
}
