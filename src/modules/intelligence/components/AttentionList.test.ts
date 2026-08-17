import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { AttentionList } from '@/modules/intelligence/components/AttentionList'
import type { AttentionItem, AttentionPriority } from '@/modules/intelligence/orchestrator/types'

afterEach(() => cleanup())

function item(type: AttentionItem['type'], priority: AttentionPriority, message: string): AttentionItem {
  return { type, message, priority }
}

/**
 * Capability Audit #12, item #2 — priority consumer activation. Prior to
 * this, AttentionList rendered items in whatever order the orchestrator
 * produced them, ignoring `priority` entirely — a high-priority item could
 * render below a low-priority one in the Chat/Nova drawer.
 */
describe('AttentionList — priority-aware ordering (Capability Audit #12)', () => {
  it('renders higher-priority items before lower-priority ones, regardless of input order', () => {
    render(
      createElement(AttentionList, {
        items: [
          item('inactive_workspace', 'low', 'Low priority item'),
          item('contradictory_memories', 'high', 'High priority item'),
          item('asked_before', 'medium', 'Medium priority item'),
        ],
      }),
    )
    const rendered = screen.getAllByRole('listitem').map((el) => el.textContent)
    expect(rendered).toEqual(['⚠ High priority item', '⚠ Medium priority item', '⚠ Low priority item'])
  })

  it('does not bury a high-priority item beneath a low-priority one that came first', () => {
    render(
      createElement(AttentionList, {
        items: [item('inactive_workspace', 'low', 'Buried candidate'), item('contradictory_memories', 'high', 'Urgent')],
      }),
    )
    const rendered = screen.getAllByRole('listitem').map((el) => el.textContent)
    expect(rendered.indexOf('⚠ Urgent')).toBeLessThan(rendered.indexOf('⚠ Buried candidate'))
  })

  it('preserves existing message rendering (⚠ prefix, plain text, no markup change)', () => {
    render(createElement(AttentionList, { items: [item('unfinished_book', 'medium', 'You have an unfinished book.')] }))
    expect(screen.getByText('⚠ You have an unfinished book.')).toBeTruthy()
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(createElement(AttentionList, { items: [] }))
    expect(container.firstChild).toBeNull()
  })

  it('renders a single item unchanged regardless of its priority', () => {
    render(createElement(AttentionList, { items: [item('stopped_midway', 'low', 'Only item')] }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('⚠ Only item')).toBeTruthy()
  })

  // Regression proof for the stated constraint: AttentionCenterSection
  // (Dashboard) already calls this component once per priority group, so
  // every array it passes has a single, uniform priority. Sorting must be a
  // no-op there — this pins that guarantee directly.
  it('leaves relative order unchanged within a single-priority group (Dashboard usage is unaffected)', () => {
    render(
      createElement(AttentionList, {
        items: [
          item('disconnected_concept', 'high', 'First'),
          item('knowledge_island', 'high', 'Second'),
          item('contradictory_memories', 'high', 'Third'),
        ],
      }),
    )
    const rendered = screen.getAllByRole('listitem').map((el) => el.textContent)
    expect(rendered).toEqual(['⚠ First', '⚠ Second', '⚠ Third'])
  })
})
