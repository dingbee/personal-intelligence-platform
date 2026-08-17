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

  // Retrieval Prerequisite Fix — Phase 2: low-confidence fallback ('ask',
  // matchedRule 'fallback-ask'/'empty-input') keeps a broader safety-net
  // requiredContext instead of PLANNING_RULES.ask's own narrow row.
  describe('low-confidence fallback context', () => {
    it.each(['What did I say about Tanzania yesterday?', 'blah blah nothing in particular', 'purple elephant migration patterns'])(
      'gives "%s" (no rule match -> ask) the documents/memory/knowledge_graph safety net',
      (text) => {
        const plan = buildReasoningPlan({ text, signals: signals() })
        expect(plan.intent).toBe('ask')
        expect(plan.requiredContext).toEqual(expect.arrayContaining(['documents', 'memory', 'knowledge_graph']))
      },
    )

    it('does not widen a confidently-matched intent the same way (explain keeps its own narrower row)', () => {
      const plan = buildReasoningPlan({ text: 'Explain how this works.', signals: signals() })
      expect(plan.intent).toBe('explain')
      expect(plan.requiredContext).not.toContain('memory')
    })

    it('does not add notes to the fallback safety net (no code evidence supports it)', () => {
      const plan = buildReasoningPlan({ text: 'purple elephant migration patterns', signals: signals() })
      expect(plan.requiredContext).not.toContain('notes')
    })
  })

  // Retrieval Prerequisite Fix — Phase 3: a confirmed continuation
  // broadens requiredContext (documents/memory/recent_conversations/
  // reading_progress), merged on top of — never replacing — the base
  // intent's own requirement.
  describe('continuation broadens requiredContext', () => {
    it('broadens a confidently-matched intent\'s context without dropping its own requirements', () => {
      const plan = buildReasoningPlan({ text: 'Compare Deep Work and Atomic Habits.', signals: signals({ isContinuation: true }) })
      expect(plan.intent).toBe('compare')
      // Base intent's own requirement (documents, knowledge_graph) survives...
      expect(plan.requiredContext).toEqual(expect.arrayContaining(['documents', 'knowledge_graph']))
      // ...and continuation adds memory/recent_conversations/reading_progress on top.
      expect(plan.requiredContext).toEqual(expect.arrayContaining(['memory', 'recent_conversations', 'reading_progress']))
    })

    it('does not broaden context when the message is not a continuation', () => {
      const plan = buildReasoningPlan({ text: 'Compare Deep Work and Atomic Habits.', signals: signals({ isContinuation: false }) })
      expect(plan.requiredContext).not.toContain('memory')
      expect(plan.requiredContext).not.toContain('recent_conversations')
    })

    it('broadens the low-confidence fallback case too, when the same turn is also a continuation ("why?")', () => {
      const plan = buildReasoningPlan({ text: 'why?', signals: signals({ isContinuation: true }) })
      expect(plan.intent).toBe('ask')
      expect(plan.requiredContext).toEqual(
        expect.arrayContaining(['documents', 'memory', 'knowledge_graph', 'recent_conversations', 'reading_progress']),
      )
    })

    it('never duplicates a context value already required by the base intent', () => {
      const plan = buildReasoningPlan({ text: 'Help me plan my week.', signals: signals({ isContinuation: true }) })
      const occurrences = plan.requiredContext.filter((value) => value === 'documents').length
      expect(occurrences).toBe(1)
    })
  })

  // Retrieval Prerequisite Fix — Phase 4: assets/spreadsheet remain
  // deliberately outside the requiredContext vocabulary. There is nothing
  // to assert about an absent union member at the type level, so this
  // documents the decision at the value level: no requiredContext array
  // the planner produces, across every intent and every signal
  // combination, ever contains anything asset/spreadsheet-related.
  describe('asset/spreadsheet context (deliberately excluded)', () => {
    const ALL_TEXTS = [
      'What is this?', 'Explain how this works.', 'Compare these two.', 'Find this document.',
      'Help me learn this topic.', 'Teach me how this works.', 'Summarize this.', 'Analyze these trends.',
      'Should I do this?', 'Help me plan my week.', 'Open chapter 3.', 'Review my highlights.',
      'Continue where I left off.', 'Create a note about this.', 'Organize my documents.', 'why?',
    ]

    it('never includes an asset or spreadsheet value in requiredContext, for any intent or signal combination', () => {
      for (const text of ALL_TEXTS) {
        for (const isContinuation of [false, true]) {
          const plan = buildReasoningPlan({ text, signals: signals({ isContinuation }) })
          expect(plan.requiredContext.join(',')).not.toMatch(/asset|spreadsheet/i)
        }
      }
    })
  })
})
