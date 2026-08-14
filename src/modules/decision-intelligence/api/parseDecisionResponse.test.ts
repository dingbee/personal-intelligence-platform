import { describe, expect, it } from 'vitest'
import { parseDecisionResponse } from '@/modules/decision-intelligence/api/parseDecisionResponse'
import type { DecisionContextSource } from '@/modules/decision-intelligence/decision'

function json(obj: unknown): string {
  return JSON.stringify(obj)
}

const sources: DecisionContextSource[] = [
  { id: 'src-1', type: 'document', title: 'Doc A', excerpt: 'excerpt A' },
  { id: 'src-2', type: 'note', title: 'Note B', excerpt: 'excerpt B' },
]

describe('parseDecisionResponse', () => {
  it('returns invalid for non-JSON text', () => {
    expect(parseDecisionResponse('not json', []).status).toBe('invalid')
  })

  it('returns invalid when the JSON object has no usable title', () => {
    expect(parseDecisionResponse(json({ alternatives: [] }), []).status).toBe('invalid')
  })

  it('returns declined when the model reports the decision unanalyzable', () => {
    const result = parseDecisionResponse(json({ declined: true, reason: 'Not enough alternatives.' }), [])
    expect(result).toEqual({ status: 'declined', reason: 'Not enough alternatives.' })
  })

  it('falls back to a generic decline reason when none is supplied', () => {
    const result = parseDecisionResponse(json({ declined: true }), [])
    expect(result.status).toBe('declined')
    if (result.status === 'declined') expect(result.reason).toContain('could not be analyzed')
  })

  it('strips markdown code fences before parsing', () => {
    expect(parseDecisionResponse('```json\n' + json({ title: 'D' }) + '\n```', []).status).toBe('decision')
  })

  it('resolves alternative/criterion localId references and drops self/unresolvable dependencies elsewhere', () => {
    const result = parseDecisionResponse(
      json({
        title: 'Decision',
        alternatives: [
          { localId: 'a1', title: 'Alt 1', description: 'd' },
          { localId: 'a2', title: 'Alt 2', description: 'd' },
        ],
        criteria: [{ localId: 'c1', name: 'Cost', description: 'd', weight: 5 }],
        evaluations: [
          { alternativeId: 'a1', criterionId: 'c1', score: 7, rationale: 'r' },
          { alternativeId: 'a2', criterionId: 'c1', score: 3, rationale: 'r' },
          { alternativeId: 'ghost', criterionId: 'c1', score: 5, rationale: 'r' }, // dangling, dropped
        ],
        recommendedAlternativeId: 'a1',
      }),
      [],
    )
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.alternatives).toHaveLength(2)
    expect(result.decision.criteria).toHaveLength(1)
    expect(result.decision.evaluations).toHaveLength(2) // the dangling one was dropped
    const a1Id = result.decision.alternatives.find((a) => a.title === 'Alt 1')!.id
    expect(result.decision.recommendedAlternativeId).toBe(a1Id)
  })

  it('drops a criterion whose weight is not a finite number', () => {
    const result = parseDecisionResponse(json({ title: 'D', criteria: [{ localId: 'c1', name: 'Bad', description: '', weight: 'high' }] }), [])
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.criteria).toEqual([])
  })

  it('keeps a criterion with a non-positive weight (validateDecision.ts is what flags it, not the parser)', () => {
    const result = parseDecisionResponse(json({ title: 'D', criteria: [{ localId: 'c1', name: 'Zero', description: '', weight: 0 }] }), [])
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.criteria).toHaveLength(1)
    expect(result.decision.criteria[0]!.weight).toBe(0)
  })

  it('drops an evaluation with a score outside the 0-10 range', () => {
    const result = parseDecisionResponse(
      json({
        title: 'D',
        alternatives: [{ localId: 'a1', title: 'A', description: '' }],
        criteria: [{ localId: 'c1', name: 'C', description: '', weight: 1 }],
        evaluations: [{ alternativeId: 'a1', criterionId: 'c1', score: 15, rationale: 'r' }],
      }),
      [],
    )
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.evaluations).toEqual([])
  })

  it('resolves evidenceNumbers to real source ids, dropping out-of-range or non-integer numbers', () => {
    const result = parseDecisionResponse(
      json({ title: 'D', alternatives: [{ localId: 'a1', title: 'A', description: '', evidenceNumbers: [1, 2, 99, 1.5] }] }),
      sources,
    )
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.alternatives[0]!.evidenceIds.sort()).toEqual(['src-1', 'src-2'])
  })

  it('assigns a valid InformationOrigin to assumptions, defaulting to unknown for an invalid value', () => {
    const result = parseDecisionResponse(json({ title: 'D', assumptions: [{ statement: 'x', origin: 'not-real' }] }), [])
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.assumptions[0]!.origin).toBe('unknown')
  })

  it('drops a risk with an invalid impact value', () => {
    const result = parseDecisionResponse(json({ title: 'D', risks: [{ description: 'r', impact: 'catastrophic' }] }), [])
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.risks).toEqual([])
  })

  it('drops a constraint with an invalid type or severity', () => {
    const result = parseDecisionResponse(json({ title: 'D', constraints: [{ constraint: 'c', type: 'not-a-type', severity: 'hard' }] }), [])
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.constraints).toEqual([])
  })

  it('keeps only the first evaluation for a duplicate (alternative, criterion) pair', () => {
    const result = parseDecisionResponse(
      json({
        title: 'D',
        alternatives: [{ localId: 'a1', title: 'A', description: '' }],
        criteria: [{ localId: 'c1', name: 'C', description: '', weight: 1 }],
        evaluations: [
          { alternativeId: 'a1', criterionId: 'c1', score: 3, rationale: 'first' },
          { alternativeId: 'a1', criterionId: 'c1', score: 9, rationale: 'second' },
        ],
      }),
      [],
    )
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.evaluations).toHaveLength(1)
    expect(result.decision.evaluations[0]!.rationale).toBe('first')
  })

  it('a recommendedAlternativeId that does not resolve becomes null rather than a fabricated id', () => {
    const result = parseDecisionResponse(json({ title: 'D', recommendedAlternativeId: 'ghost' }), [])
    expect(result.status).toBe('decision')
    if (result.status !== 'decision') return
    expect(result.decision.recommendedAlternativeId).toBeNull()
  })
})
