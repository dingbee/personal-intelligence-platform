import { describe, expect, it } from 'vitest'
import { parseActionResponse } from '@/modules/action-intelligence/api/parseActionResponse'
import type { ActionContextSource } from '@/modules/action-intelligence/action'

function json(obj: unknown): string {
  return JSON.stringify(obj)
}

const sources: ActionContextSource[] = [
  { id: 'src-1', type: 'document', title: 'Doc A', excerpt: 'excerpt A' },
  { id: 'src-2', type: 'note', title: 'Note B', excerpt: 'excerpt B' },
]

const objectives = [
  { id: 'obj-1', content: 'Grow enrollment' },
  { id: 'obj-2', content: 'Ship the beta' },
]

describe('parseActionResponse', () => {
  it('returns invalid for non-JSON text', () => {
    expect(parseActionResponse('not json', [], []).status).toBe('invalid')
  })

  it('returns invalid when the JSON object has no usable title', () => {
    expect(parseActionResponse(json({ actions: [] }), [], []).status).toBe('invalid')
  })

  it('returns invalid when actions is missing entirely', () => {
    expect(parseActionResponse(json({ title: 'Set' }), [], []).status).toBe('invalid')
  })

  it('returns declined when the model reports nothing actionable', () => {
    const result = parseActionResponse(json({ declined: true, reason: 'Nothing to act on yet.' }), [], [])
    expect(result).toEqual({ status: 'declined', reason: 'Nothing to act on yet.' })
  })

  it('falls back to a generic decline reason when none is supplied', () => {
    const result = parseActionResponse(json({ declined: true }), [], [])
    expect(result.status).toBe('declined')
    if (result.status === 'declined') expect(result.reason).toContain('nothing actionable')
  })

  it('strips markdown code fences before parsing', () => {
    expect(parseActionResponse('```json\n' + json({ title: 'Set', actions: [] }) + '\n```', [], []).status).toBe('action_set')
  })

  it('drops a malformed action draft (missing localId or title) without failing the whole response', () => {
    const result = parseActionResponse(
      json({ title: 'Set', actions: [{ localId: 'a1', title: 'Real action', description: 'd' }, { title: 'No localId' }, { localId: 'a2' }] }),
      [],
      [],
    )
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions).toHaveLength(1)
    expect(result.fields.actions[0]!.title).toBe('Real action')
  })

  it('defaults an invalid enum (type/priority) rather than rejecting the action', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', type: 'not-a-type', priority: 'urgent!!' }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.type).toBe('action')
    expect(result.fields.actions[0]!.priority).toBe('medium')
  })

  it('resolves an action-kind dependency targetLocalId to the real generated id', () => {
    const result = parseActionResponse(
      json({
        title: 'Set',
        actions: [
          { localId: 'a1', title: 'First' },
          { localId: 'a2', title: 'Second', dependsOn: [{ kind: 'action', targetLocalId: 'a1', description: 'needs first' }] },
        ],
      }),
      [],
      [],
    )
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    const a1Id = result.fields.actions.find((a) => a.title === 'First')!.id
    const second = result.fields.actions.find((a) => a.title === 'Second')!
    expect(second.dependencies).toHaveLength(1)
    expect(second.dependencies[0]!.targetId).toBe(a1Id)
  })

  it('drops a dangling action-dependency reference (unresolvable targetLocalId)', () => {
    const result = parseActionResponse(
      json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', dependsOn: [{ kind: 'action', targetLocalId: 'ghost', description: 'x' }] }] }),
      [],
      [],
    )
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dependencies).toEqual([])
  })

  it('drops a self-referential action dependency', () => {
    const result = parseActionResponse(
      json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', dependsOn: [{ kind: 'action', targetLocalId: 'a1', description: 'x' }] }] }),
      [],
      [],
    )
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dependencies).toEqual([])
  })

  it('keeps a decision-kind dependency with a description and no targetId', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', dependsOn: [{ kind: 'decision', description: 'pricing not finalized' }] }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dependencies).toEqual([{ id: expect.any(String), kind: 'decision', targetId: null, description: 'pricing not finalized' }])
  })

  it('drops a decision-kind dependency with no description', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', dependsOn: [{ kind: 'decision' }] }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dependencies).toEqual([])
  })

  it('resolves an objective-kind dependency objectiveNumber to the real workspace objective id', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', dependsOn: [{ kind: 'objective', objectiveNumber: 2, description: 'supports this' }] }] }), [], objectives)
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dependencies[0]!.targetId).toBe('obj-2')
  })

  it('drops an out-of-range objectiveNumber rather than guessing', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', dependsOn: [{ kind: 'objective', objectiveNumber: 99, description: 'x' }] }] }), [], objectives)
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dependencies).toEqual([])
  })

  it('defaults actor to unassigned when no label is given, even if a type is claimed', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', actor: { type: 'described', label: null } }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.actor).toEqual({ type: 'unassigned', label: null })
  })

  it('keeps a described actor with a real label', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', actor: { type: 'described', label: 'the finance team' } }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.actor).toEqual({ type: 'described', label: 'the finance team' })
  })

  it('resolves evidenceNumbers to real source ids, dropping out-of-range or non-integer numbers', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A', evidenceNumbers: [1, 2, 99, 1.5] }] }), sources, [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.evidenceIds.sort()).toEqual(['src-1', 'src-2'])
  })

  it('never sets readiness or source on a parsed action', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A' }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]).not.toHaveProperty('readiness')
    expect(result.fields.actions[0]).not.toHaveProperty('source')
  })

  it('never invents a dueHint when none was stated', () => {
    const result = parseActionResponse(json({ title: 'Set', actions: [{ localId: 'a1', title: 'A' }] }), [], [])
    expect(result.status).toBe('action_set')
    if (result.status !== 'action_set') return
    expect(result.fields.actions[0]!.dueHint).toBeNull()
  })
})
