import { describe, expect, it } from 'vitest'
import { buildReasoningPlan, type PlannerSignals } from '@/modules/intelligence/planner/planner'

function signals(overrides: Partial<PlannerSignals> = {}): PlannerSignals {
  return { hasInProgressDocument: false, hasMemoryContext: false, hasGraphContext: false, isContinuation: false, ...overrides }
}

describe('buildReasoningPlan', () => {
  it("matches the brief's worked example: a learning request plans a multi-step strategy with reading/notes/flashcards/conversations", () => {
    const plan = buildReasoningPlan({ text: 'Help me prepare for my MBA exam.', signals: signals({ hasInProgressDocument: true }) })
    expect(plan.intent).toBe('learn')
    expect(plan.strategy).toBe('multi-step')
    expect(plan.requiredContext).toEqual(
      expect.arrayContaining(['reading_progress', 'notes', 'flashcards', 'recent_conversations']),
    )
  })

  it('includes reader-continue in suggestions only when a document is actually in progress', () => {
    const withDocument = buildReasoningPlan({ text: 'Where was I in Deep Work?', signals: signals({ hasInProgressDocument: true }) })
    expect(withDocument.suggestedCommandIds).toContain('reader-continue')

    const withoutDocument = buildReasoningPlan({ text: 'Where was I in Deep Work?', signals: signals({ hasInProgressDocument: false }) })
    expect(withoutDocument.suggestedCommandIds).not.toContain('reader-continue')
  })

  it('never suggests a command id outside the real registry set', () => {
    const REAL_IDS = new Set([
      'reader-continue', 'knowledge-explore', 'search-open', 'dashboard-open',
      'memory-manage', 'memory-review-suggestions', 'notes-create', 'nav-library',
    ])
    const examples = [
      'What is this?',
      'Explain how this works.',
      'Compare these two.',
      'Find this document.',
      'Help me learn this topic.',
      'Teach me how this works.',
      'Summarize this.',
      'Analyze these trends.',
      'Should I do this?',
      'Help me plan my week.',
      'Open chapter 3.',
      'Review my highlights.',
      'Continue where I left off.',
      'Create a note about this.',
      'Organize my documents.',
    ]
    for (const text of examples) {
      const plan = buildReasoningPlan({ text, signals: signals({ hasInProgressDocument: true }) })
      expect(plan.suggestedCommandIds.every((id) => REAL_IDS.has(id))).toBe(true)
    }
  })

  it('upgrades a single-step plan to multi-step when the message continues an existing conversation', () => {
    const plan = buildReasoningPlan({ text: 'What is a knowledge graph?', signals: signals({ isContinuation: true }) })
    expect(plan.strategy).toBe('multi-step')
  })

  it('leaves a naturally multi-step plan unchanged when continuation is also true', () => {
    const plan = buildReasoningPlan({ text: 'Help me plan my week.', signals: signals({ isContinuation: true }) })
    expect(plan.strategy).toBe('multi-step')
  })

  it('does not upgrade strategy when the message is not a continuation', () => {
    const plan = buildReasoningPlan({ text: 'What is a knowledge graph?', signals: signals({ isContinuation: false }) })
    expect(plan.strategy).toBe('single-step')
  })

  it('assigns a comparative strategy for a comparison request', () => {
    const plan = buildReasoningPlan({ text: 'Compare Deep Work and Atomic Habits.', signals: signals() })
    expect(plan.strategy).toBe('comparative')
  })

  it('assigns a decision strategy for a decide request', () => {
    const plan = buildReasoningPlan({ text: 'Should I switch to a new provider?', signals: signals() })
    expect(plan.strategy).toBe('decision')
  })

  it('always returns a response strategy consistent with responseStrategy.ts', () => {
    const plan = buildReasoningPlan({ text: 'Summarize everything in my workspace.', signals: signals() })
    expect(plan.responseStrategy).toBe('executive_summary')
  })

  it('is a pure function of its inputs', () => {
    const a = buildReasoningPlan({ text: 'Explain this.', signals: signals() })
    const b = buildReasoningPlan({ text: 'Explain this.', signals: signals() })
    expect(a).toEqual(b)
  })
})
