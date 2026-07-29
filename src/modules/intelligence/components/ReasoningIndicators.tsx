import type { ReasoningTrace } from '@/modules/intelligence/planner/reasoningTrace'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

const INTENT_LABEL: Record<ReasoningTrace['intent'], string> = {
  plan: 'Planning',
  decide: 'Deciding',
  compare: 'Comparing',
  organize: 'Organizing',
  create: 'Creating',
  summarize: 'Summarizing',
  analyze: 'Analyzing',
  review: 'Reviewing',
  continue: 'Continuing',
  teach: 'Teaching',
  learn: 'Learning',
  search: 'Searching',
  read: 'Reading',
  explain: 'Explaining',
  ask: 'Answering',
}

const STRATEGY_LABEL: Record<ReasoningTrace['responseStrategy'], string> = {
  brief: 'Brief',
  standard: 'Standard',
  exploratory: 'Exploratory',
  tutorial: 'Tutorial',
  decision: 'Decision',
  comparison: 'Comparison',
  planning: 'Planning',
  executive_summary: 'Executive summary',
}

/**
 * UX-12 Phase 10 — Chat Integration. Displays the current Intent, Response
 * Strategy, and (when present) Learning/Decision mode indicators, reusing
 * the existing StatusBadge primitive — no new design language, no chat
 * redesign. This is metadata about how NOVA is approaching the message,
 * never the model's actual reasoning text.
 */
export function ReasoningIndicators({ trace }: { trace: ReasoningTrace }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge label={INTENT_LABEL[trace.intent]} variant="info" />
      <StatusBadge label={STRATEGY_LABEL[trace.responseStrategy]} variant="neutral" />
      {trace.learningMode && <StatusBadge label={`Learning: ${trace.learningMode.stage.replace('_', ' ')}`} variant="success" />}
      {trace.decisionFramework && <StatusBadge label="Decision mode" variant="warning" />}
    </div>
  )
}
