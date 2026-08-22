import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOutcomeEvaluations } from '@/modules/learning-intelligence/hooks/useOutcomeEvaluations'
import { useRecordIntelligenceOutcome } from '@/modules/learning-intelligence/hooks/useRecordIntelligenceOutcome'
import { deriveDecisionPatternKey, derivePlanningPatternKey } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'
import type { PlanVarianceCategory } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'
import type { OutcomeComparisonResult } from '@/modules/learning-intelligence/learning'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

// I8.16 — mirrors the SUCCESSFUL/PARTIALLY_SUCCESSFUL/UNSUCCESSFUL/INCONCLUSIVE
// vocabulary the sprint asks for, reusing the same OutcomeComparisonResult
// enum every record type already shares rather than inventing a second one.
const COMPARISON_LABEL: Record<OutcomeComparisonResult, string> = {
  match: 'Successful — matched the expected outcome',
  partial_match: 'Partially successful',
  miss: 'Unsuccessful — did not achieve the expected outcome',
  contradiction: 'Unsuccessful — result actively contradicts what was expected',
  unknown: 'Inconclusive',
}

const PLAN_VARIANCE_LABEL: Record<PlanVarianceCategory, string> = {
  timeline_variance: 'Timeline (took longer/shorter than expected)',
  resource_variance: 'Resource estimate was off',
  dependency_variance: 'A dependency caused unexpected delay/failure',
  milestone_realism: 'A milestone was unrealistic',
  general: 'General / other',
}

function extractDecisionConfidence(structuredOutput: Record<string, unknown>): 'low' | 'medium' | 'high' | null {
  const confidence = structuredOutput.confidence
  return confidence === 'low' || confidence === 'medium' || confidence === 'high' ? confidence : null
}

function RecordOutcomeForm({ record }: { record: IntelligenceRecord }) {
  const [actualOutcome, setActualOutcome] = useState('')
  const [comparisonResult, setComparisonResult] = useState<OutcomeComparisonResult>('match')
  const [planCategory, setPlanCategory] = useState<PlanVarianceCategory>('general')
  const mutation = useRecordIntelligenceOutcome(record.id)

  const decisionConfidence = record.recordType === 'decision' ? extractDecisionConfidence(record.structuredOutput) : null
  const canSubmit = record.expectedOutcome && actualOutcome.trim().length > 0 && (record.recordType !== 'decision' || decisionConfidence !== null)

  function handleSubmit() {
    if (!record.expectedOutcome || !canSubmit) return
    const patternKey = record.recordType === 'decision' && decisionConfidence ? deriveDecisionPatternKey(decisionConfidence) : derivePlanningPatternKey(planCategory)
    mutation.mutate({
      recordId: record.id,
      source: 'user_feedback',
      expectedOutcome: record.expectedOutcome,
      actualOutcome: actualOutcome.trim(),
      comparisonResult,
      patternKey,
      feedbackNote: actualOutcome.trim(),
    })
  }

  if (!record.expectedOutcome) {
    return <p className="text-xs text-[var(--color-ink-muted)]">No expected outcome was recorded for this {record.recordType} — nothing to compare against yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={actualOutcome}
        onChange={(e) => setActualOutcome(e.target.value)}
        placeholder="What actually happened?"
        rows={2}
        className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2 py-1.5 text-xs"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={comparisonResult}
          onChange={(e) => setComparisonResult(e.target.value as OutcomeComparisonResult)}
          className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-1.5 py-1 text-[10px]"
        >
          {(Object.keys(COMPARISON_LABEL) as OutcomeComparisonResult[]).map((key) => (
            <option key={key} value={key}>
              {COMPARISON_LABEL[key]}
            </option>
          ))}
        </select>
        {record.recordType === 'planning' && (
          <select
            value={planCategory}
            onChange={(e) => setPlanCategory(e.target.value as PlanVarianceCategory)}
            className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-1.5 py-1 text-[10px]"
          >
            {(Object.keys(PLAN_VARIANCE_LABEL) as PlanVarianceCategory[]).map((key) => (
              <option key={key} value={key}>
                {PLAN_VARIANCE_LABEL[key]}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          className="rounded-control bg-[var(--color-accent)] px-2 py-1 text-[10px] font-medium text-[var(--color-canvas)] disabled:opacity-50"
        >
          {mutation.isPending ? 'Recording…' : 'Record outcome'}
        </button>
      </div>
      {record.recordType === 'decision' && !decisionConfidence && <p className="text-[10px] text-[var(--color-ink-muted)]">This decision has no recorded confidence level — cannot be compared for calibration.</p>}
      {mutation.isError && <p role="alert" className="text-[10px] text-[var(--color-danger)]">{errorMessage(mutation.error, 'Failed to record outcome.')}</p>}
      {mutation.isSuccess && <p className="text-[10px] text-[var(--color-ink-muted)]">Recorded.</p>}
    </div>
  )
}

/**
 * I8.1/I8.16/I8.17 — the manual "record what actually happened" path for
 * record types with no automatic observer (decision/planning — unlike
 * 'execution', which is recorded automatically the moment I7 verifies it,
 * see recordExecutionIntelligenceRecord.ts). Every evaluation recorded
 * here is tagged source:'user_feedback' — an honest human report, never
 * silently treated as objective proof (I8.9).
 */
export function RecordOutcomeSection({ record }: { record: IntelligenceRecord }) {
  const { data: evaluations, isLoading } = useOutcomeEvaluations(record.id)
  const showForm = record.recordType === 'decision' || record.recordType === 'planning'

  if (!record.expectedOutcome && (!evaluations || evaluations.length === 0) && !showForm) return null

  return (
    <SurfaceCard>
      <SectionHeader title="Outcome" description="What was expected versus what actually happened — every evaluation kept, never overwritten." />
      <div className="mt-3 flex flex-col gap-3">
        {record.actualOutcome && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Most recent known outcome</p>
            <p className="mt-1 text-sm text-[var(--color-ink)]">{record.actualOutcome}</p>
            {record.outcomeEvaluatedAt && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">Evaluated {new Date(record.outcomeEvaluatedAt).toLocaleString()}</p>}
          </div>
        )}

        {isLoading ? (
          <Spinner size="sm" />
        ) : evaluations && evaluations.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Evaluation history ({evaluations.length})</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {evaluations.map((evaluation) => (
                <li key={evaluation.id} className="rounded-control border border-[var(--color-border)] p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge label={evaluation.source === 'user_feedback' ? 'User feedback' : 'System observed'} variant={evaluation.source === 'user_feedback' ? 'info' : 'neutral'} />
                    <StatusBadge
                      label={evaluation.comparisonResult}
                      variant={evaluation.comparisonResult === 'match' ? 'success' : evaluation.comparisonResult === 'unknown' ? 'neutral' : 'error'}
                    />
                  </div>
                  <p className="mt-1 text-[var(--color-ink)]">{evaluation.actualOutcome}</p>
                  <p className="mt-0.5 text-[var(--color-ink-muted)]">{new Date(evaluation.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
            <Link to="/learning" className="mt-1.5 inline-block text-xs text-[var(--color-accent)] hover:underline">
              See learning signals derived from this →
            </Link>
          </div>
        ) : null}

        {showForm && <RecordOutcomeForm record={record} />}
      </div>
    </SurfaceCard>
  )
}
