import { useState } from 'react'
import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { EvidenceLevel } from '@/modules/intelligence/evidence/computeEvidenceScore'
import type { ReasoningTrace } from '@/modules/intelligence/planner/reasoningTrace'
import type { ExplainSummary } from '@/modules/intelligence/explain/computeExplainSummary'
import type { AttentionItem, WorkspaceInsight } from '@/modules/intelligence/orchestrator/types'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { Command, CommandActions, CommandContext } from '@/modules/commands/types'
import { NovaContextUsedBadges } from '@/modules/intelligence/components/NovaContextUsedBadges'
import { ReferenceRow } from '@/modules/intelligence/components/ReferenceRow'
import { EvidenceBadge } from '@/modules/intelligence/components/EvidenceBadge'
import { ReasoningIndicators } from '@/modules/intelligence/components/ReasoningIndicators'
import { PlanPreviewPanel } from '@/modules/intelligence/components/PlanPreviewPanel'
import { ExplainAnswerPanel } from '@/modules/intelligence/components/ExplainAnswerPanel'
import { NovaSuggestions } from '@/modules/intelligence/components/NovaSuggestions'
import { ActionChips } from '@/modules/intelligence/components/ActionChips'
import { AttentionList } from '@/modules/intelligence/components/AttentionList'
import { SignalList } from '@/modules/intelligence/components/SignalList'
import { WorkspaceInsightList } from '@/modules/intelligence/components/WorkspaceInsightList'
import { PersonalIntelligenceTimeline } from '@/modules/intelligence/components/PersonalIntelligenceTimeline'

export type DrawerState = 'collapsed' | 'expanded' | 'fullscreen'

const STORAGE_KEY = 'nova-insight-drawer-state'

export interface NovaInsightDrawerProps {
  contextTrace: ContextTrace
  references: Reference[]
  evidenceLevel: EvidenceLevel
  reasoningTrace: ReasoningTrace | null
  explainSummary: ExplainSummary
  suggestions: string[]
  onSelectSuggestion: (suggestion: string) => void
  actionCommands: Command[]
  commandContext: CommandContext
  commandActions: CommandActions
  attentionItems: AttentionItem[]
  signals: IntelligenceSignal[]
  workspaceInsights: WorkspaceInsight[]
  workspaceId: string | null
}

function readStoredState(): DrawerState {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'expanded' || stored === 'collapsed' ? stored : 'collapsed'
}

/** A named, individually-collapsible subsection — the "▶ Sources used" / "▶ Reasoning" rows from the brief. Renders nothing when it has no content, so an empty turn (no references, no signals, ...) never shows an empty disclosure triangle. */
function Section({ title, hasContent, children }: { title: string; hasContent: boolean; children: React.ReactNode }) {
  if (!hasContent) return null
  return (
    <details className="rounded-control bg-[var(--surface-inset)] px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium text-[var(--color-ink)]">{title}</summary>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </details>
  )
}

/**
 * UX-13.5D — the NOVA Intelligence Drawer. Every piece rendered here
 * (NovaContextUsedBadges, ReferenceRow, EvidenceBadge, ReasoningIndicators,
 * PlanPreviewPanel, ExplainAnswerPanel, NovaSuggestions, ActionChips,
 * AttentionList, SignalList, WorkspaceInsightList,
 * PersonalIntelligenceTimeline) is an existing UX-6 through UX-12
 * component, unmodified — this is purely a reorganization of where they
 * render, from "always expanded, stacked under every message" into one
 * collapsed-by-default drawer with five named, individually-collapsible
 * subsections. No new intelligence logic.
 *
 * State (collapsed/expanded/fullscreen) persists to localStorage so a
 * user who expands it once doesn't have to re-expand it on every future
 * turn — same direct-localStorage pattern WorkspaceProvider already uses
 * for the current-workspace selection.
 */
export function NovaInsightDrawer(props: NovaInsightDrawerProps) {
  const [state, setState] = useState<DrawerState>(readStoredState)

  function setPersistedState(next: DrawerState) {
    setState(next)
    if (next === 'fullscreen') return // fullscreen is a transient view, not a persisted preference
    localStorage.setItem(STORAGE_KEY, next)
  }

  const hasSourcesUsed = props.contextTrace.retrievedChunks > 0 || props.contextTrace.graphNodes > 0 || props.contextTrace.memoriesUsed > 0 || props.references.length > 0
  const hasReasoning = Boolean(props.reasoningTrace)
  const hasEvidence = props.attentionItems.length > 0 || props.signals.length > 0
  const hasSuggestions = props.suggestions.length > 0 || props.actionCommands.length > 0
  const hasRelatedKnowledge = props.workspaceInsights.length > 0

  const body = (
    <div className="flex flex-col gap-2">
      <Section title="Sources used" hasContent={hasSourcesUsed}>
        <NovaContextUsedBadges contextTrace={props.contextTrace} />
        <ReferenceRow references={props.references} />
      </Section>
      <Section title="Reasoning" hasContent={hasReasoning}>
        {props.reasoningTrace && (
          <>
            <ReasoningIndicators trace={props.reasoningTrace} />
            <PlanPreviewPanel trace={props.reasoningTrace} />
          </>
        )}
        <ExplainAnswerPanel summary={props.explainSummary} />
      </Section>
      <Section title="Evidence" hasContent={hasEvidence}>
        <div className="flex items-center gap-2">
          <EvidenceBadge level={props.evidenceLevel} />
        </div>
        <AttentionList items={props.attentionItems} />
        <SignalList signals={props.signals} />
      </Section>
      <Section title="Suggestions" hasContent={hasSuggestions}>
        <NovaSuggestions suggestions={props.suggestions} onSelect={props.onSelectSuggestion} />
        <ActionChips commands={props.actionCommands} context={props.commandContext} actions={props.commandActions} />
      </Section>
      <Section title="Related knowledge" hasContent={hasRelatedKnowledge}>
        <WorkspaceInsightList insights={props.workspaceInsights} />
        <PersonalIntelligenceTimeline workspaceId={props.workspaceId} />
      </Section>
    </div>
  )

  const header = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => setPersistedState(state === 'collapsed' ? 'expanded' : 'collapsed')}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]"
        aria-expanded={state !== 'collapsed'}
      >
        <span aria-hidden>{state === 'collapsed' ? '▸' : '▾'}</span>
        <span aria-hidden>✨</span> NOVA Intelligence
      </button>
      {state !== 'collapsed' && (
        <button
          type="button"
          onClick={() => setPersistedState(state === 'fullscreen' ? 'expanded' : 'fullscreen')}
          aria-label={state === 'fullscreen' ? 'Exit fullscreen' : 'Expand to fullscreen'}
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          {state === 'fullscreen' ? '⤡ Minimize' : '⤢ Maximize'}
        </button>
      )}
    </div>
  )

  if (state === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col overflow-y-auto bg-[var(--color-surface)] p-6">
        {header}
        <div className="mt-4">{body}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-6 py-3">
      {header}
      {state === 'expanded' && body}
    </div>
  )
}
