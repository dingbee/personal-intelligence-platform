import type { ReaderInteractionState } from '@/modules/reader/intelligence/readerInteraction'
import type { LocalSuggestionId } from '@/modules/reader/intelligence/chapterSuggestions'
import type { LearningStage } from '@/modules/intelligence/learning/learningTypes'
import { ReferenceRow } from '@/modules/intelligence/components/ReferenceRow'
import { SignalList } from '@/modules/intelligence/components/SignalList'
import { PersonalIntelligenceTimeline } from '@/modules/intelligence/components/PersonalIntelligenceTimeline'
import type { CommandActions, CommandContext } from '@/modules/commands/types'

const JOURNEY_LABEL: Record<ReaderInteractionState['journey']['status'], string> = {
  not_started: 'Not started',
  started: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
}

/** Same human-readable-label pattern as JOURNEY_LABEL above — never the raw LearningStage enum value. */
const LEARNING_STAGE_LABEL: Record<LearningStage, string> = {
  starting: 'Just getting started',
  in_progress: 'In progress',
  reviewing: 'Time to review',
  practicing: 'Practicing',
  mastered: 'Mastered',
}

const OPPORTUNITY_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--color-ink)] shadow-raised transition-shadow hover:shadow-floating'

/**
 * UX-9 Phase 9/10 — everything here reuses existing primitives (plain
 * text rows, ReferenceRow/SignalList from UX-7/8) and existing routes;
 * no new design language. Mounted inside ReaderInsightDrawer (UX-13.10.2,
 * previously directly inside ReaderChatPanel) — this component owns only
 * its content now, not its own border/padding, since the drawer shell
 * provides that framing.
 */
export function ReaderIntelligencePanel({
  state,
  workspaceId,
  onLocalSuggestion,
  commandContext,
  commandActions,
}: {
  state: ReaderInteractionState
  workspaceId: string | null
  onLocalSuggestion: (id: LocalSuggestionId) => void
  commandContext: CommandContext
  commandActions: CommandActions
}) {
  return (
    <div className="flex flex-col gap-3 text-xs text-[var(--color-ink-muted)]">
      <ReferenceRow references={state.references} />

      {state.insights.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {state.insights.map((insight) => (
            <li key={insight.type}>
              <span className="font-medium text-[var(--color-ink)]">{insight.label}:</span> {insight.value}
            </li>
          ))}
        </ul>
      )}

      <SignalList signals={state.signals} />

      {state.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.suggestions.map((suggestion) => (
            <button
              key={suggestion.kind === 'local' ? suggestion.id : suggestion.command.id}
              type="button"
              onClick={() =>
                suggestion.kind === 'local' ? onLocalSuggestion(suggestion.id) : void suggestion.command.execute(commandContext, commandActions)
              }
              className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--color-ink)] shadow-raised transition-shadow hover:shadow-floating"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}

      <p>
        <span className="font-medium text-[var(--color-ink)]">Reading journey:</span> {JOURNEY_LABEL[state.journey.status]} ·{' '}
        {state.journey.summarizedChapterCount} summarized · {state.journey.flashcardCount} flashcard
        {state.journey.flashcardCount === 1 ? '' : 's'} · {state.journey.notesAddedCount} note
        {state.journey.notesAddedCount === 1 ? '' : 's'} · {state.journey.questionsAskedCount} conversation
        {state.journey.questionsAskedCount === 1 ? '' : 's'}
      </p>

      {/* Capability Audit #11+ — interpretation of the journey facts above,
          not a duplicate of them: visually set apart in its own inset
          block so it doesn't blend into the passive stats line. */}
      {state.learningMode && (
        <div className="flex flex-col gap-1.5 rounded-control bg-[var(--surface-inset)] p-2 shadow-inset">
          <p>
            <span className="font-medium text-[var(--color-ink)]">Learning:</span> {LEARNING_STAGE_LABEL[state.learningMode.stage]}
          </p>
          <p>{state.learningMode.suggestedNextStep}</p>
          {(state.learningMode.reviewOpportunity || state.learningMode.practiceOpportunity) && (
            <div className="flex flex-wrap gap-1.5">
              {state.learningMode.reviewOpportunity && (
                <button type="button" onClick={() => onLocalSuggestion('highlights')} className={OPPORTUNITY_BUTTON_CLASS}>
                  Review your highlights
                </button>
              )}
              {state.learningMode.practiceOpportunity && (
                <button type="button" onClick={() => onLocalSuggestion('flashcards')} className={OPPORTUNITY_BUTTON_CLASS}>
                  Practice with flashcards
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <details>
        <summary className="cursor-pointer select-none hover:text-[var(--color-ink)]">More from your knowledge</summary>
        <div className="mt-2">
          <PersonalIntelligenceTimeline workspaceId={workspaceId} />
        </div>
      </details>
    </div>
  )
}
