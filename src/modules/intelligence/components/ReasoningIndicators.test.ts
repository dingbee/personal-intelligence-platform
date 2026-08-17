import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { ReasoningIndicators } from '@/modules/intelligence/components/ReasoningIndicators'
import type { ReasoningTrace } from '@/modules/intelligence/planner/reasoningTrace'
import type { ReasoningPlan, ReasoningStrategy } from '@/modules/intelligence/planner/plannerTypes'

afterEach(() => cleanup())

function baseTrace(overrides: Partial<ReasoningTrace> = {}): ReasoningTrace {
  const plan: ReasoningPlan = {
    intent: 'ask',
    strategy: 'single-step',
    requiredContext: [],
    responseStrategy: 'standard',
    suggestedCommandIds: [],
  }
  return {
    retrievedChunks: 0,
    graphNodes: 0,
    memoriesUsed: 0,
    intent: 'ask',
    strategy: 'single-step',
    planner: plan,
    responseStrategy: 'standard',
    selectedContext: { included: [], skipped: [] },
    decisionFramework: null,
    learningMode: null,
    ...overrides,
  }
}

// Capability Audit #12 — strategy consumer activation. Prior to this,
// ReasoningTrace.strategy was computed on every turn but had no rendering
// slot at all; these tests pin the fixed contract.
describe('ReasoningIndicators — Reasoning Strategy (Capability Audit #12)', () => {
  it.each<[ReasoningStrategy, string]>([
    ['single-step', 'Single-step'],
    ['multi-step', 'Multi-step'],
    ['exploratory', 'Exploratory'],
    ['comparative', 'Comparative'],
    ['decision', 'Decision'],
  ])('renders the human-readable label for strategy %s', (strategy, label) => {
    render(createElement(ReasoningIndicators, { trace: baseTrace({ strategy }) }))
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('renders the strategy indicator whenever a trace is present', () => {
    render(createElement(ReasoningIndicators, { trace: baseTrace({ strategy: 'exploratory' }) }))
    expect(screen.getByText('Exploratory')).toBeTruthy()
  })

  it('leaves the existing Intent and Response Strategy indicators unaffected', () => {
    render(createElement(ReasoningIndicators, { trace: baseTrace({ intent: 'compare', responseStrategy: 'comparison', strategy: 'comparative' }) }))
    expect(screen.getByText('Comparing')).toBeTruthy()
    expect(screen.getByText('Comparison')).toBeTruthy()
    // 'Comparative' (reasoning strategy) is a distinct label from 'Comparing' (intent) and 'Comparison' (response strategy).
    expect(screen.getByText('Comparative')).toBeTruthy()
  })

  it('leaves Learning Mode and Decision Framework indicators unaffected when present', () => {
    render(
      createElement(ReasoningIndicators, {
        trace: baseTrace({
          learningMode: { stage: 'in_progress', knowledgeLevel: 'developing', suggestedNextStep: 'Keep going.', reviewOpportunity: false, practiceOpportunity: false },
          decisionFramework: { options: [], pros: [], cons: [], risks: [], recommendation: null, confidence: 'low' },
        }),
      }),
    )
    expect(screen.getByText('Learning: in progress')).toBeTruthy()
    expect(screen.getByText('Decision mode')).toBeTruthy()
  })

  it('does not render Learning Mode or Decision Framework indicators when absent', () => {
    render(createElement(ReasoningIndicators, { trace: baseTrace() }))
    expect(screen.queryByText(/Learning:/)).toBeNull()
    expect(screen.queryByText('Decision mode')).toBeNull()
  })
})
