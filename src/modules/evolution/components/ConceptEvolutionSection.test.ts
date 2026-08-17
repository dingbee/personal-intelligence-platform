import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ConceptEvolutionSection } from '@/modules/evolution/components/ConceptEvolutionSection'
import type { ConceptEvolution, ConceptTrendStatus } from '@/modules/evolution/conceptEvolution/conceptTrend'

afterEach(() => cleanup())

function concept(overrides: Partial<ConceptEvolution> = {}): ConceptEvolution {
  return {
    nodeId: 'node-1',
    title: 'Deep Work',
    status: 'stable',
    sourceCountTotal: 1,
    sourceCountRecent: 0,
    degree: 2,
    ageDays: 10,
    daysSinceLastActivity: 3,
    ...overrides,
  }
}

function renderSection(concepts: ConceptEvolution[]) {
  return render(createElement(MemoryRouter, null, createElement(ConceptEvolutionSection, { concepts })))
}

/**
 * Capability Audit #12, item #3 — concept row consumer-chain activation.
 * `nodeId` was already computed and typed but only used as a React key;
 * these tests pin the new contract: each row links to the existing
 * KnowledgeNodeDetailPage route, and everything else about the row
 * (content, ordering, limit, empty state, status styling) is unchanged.
 */
describe('ConceptEvolutionSection — node drill-down link (Capability Audit #12)', () => {
  it('links each row to the existing /knowledge/nodes/:nodeId route, keyed by the correct nodeId', () => {
    renderSection([
      concept({ nodeId: 'node-a', title: 'Deep Work', status: 'growing' }),
      concept({ nodeId: 'node-b', title: 'Systems Thinking', status: 'emerging' }),
    ])
    const deepWorkLink = screen.getByRole('link', { name: /Deep Work/ })
    expect(deepWorkLink.getAttribute('href')).toBe('/knowledge/nodes/node-a')
    const systemsLink = screen.getByRole('link', { name: /Systems Thinking/ })
    expect(systemsLink.getAttribute('href')).toBe('/knowledge/nodes/node-b')
  })

  it('renders a real, keyboard-focusable anchor element (native link semantics, not a div/onClick)', () => {
    renderSection([concept({ nodeId: 'node-a', title: 'Deep Work' })])
    const link = screen.getByRole('link', { name: /Deep Work/ })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBeTruthy()
  })

  it('preserves the existing sort order — emerging/growing before dormant/stable', () => {
    renderSection([
      concept({ nodeId: 'n-stable', title: 'Stable Concept', status: 'stable' }),
      concept({ nodeId: 'n-emerging', title: 'Emerging Concept', status: 'emerging' }),
      concept({ nodeId: 'n-dormant', title: 'Dormant Concept', status: 'dormant' }),
      concept({ nodeId: 'n-growing', title: 'Growing Concept', status: 'growing' }),
    ])
    const links = screen.getAllByRole('link').map((el) => el.textContent)
    expect(links).toEqual([
      expect.stringContaining('Emerging Concept'),
      expect.stringContaining('Growing Concept'),
      expect.stringContaining('Dormant Concept'),
      expect.stringContaining('Stable Concept'),
    ])
  })

  it('preserves the existing DISPLAY_LIMIT of 20 rows', () => {
    const concepts = Array.from({ length: 25 }, (_, i) => concept({ nodeId: `node-${i}`, title: `Concept ${i}` }))
    renderSection(concepts)
    expect(screen.getAllByRole('link')).toHaveLength(20)
  })

  it('renders the existing empty state, unchanged, when there are no concepts', () => {
    renderSection([])
    expect(screen.getByText('No concepts yet')).toBeTruthy()
    expect(screen.getByText('Extract knowledge from a document to see how concepts evolve.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('preserves existing status labels and connection-count text for every status', () => {
    const statuses: ConceptTrendStatus[] = ['emerging', 'growing', 'stable', 'dormant']
    const labels = { emerging: 'Emerging', growing: 'Growing', stable: 'Stable', dormant: 'Dormant' }
    renderSection(statuses.map((status, i) => concept({ nodeId: `node-${i}`, title: `Concept ${i}`, status, degree: 1 })))
    for (const status of statuses) {
      expect(screen.getByText(labels[status])).toBeTruthy()
    }
    expect(screen.getAllByText('1 connection')).toHaveLength(4)
  })

  it('pluralizes the connection count correctly, unchanged from before', () => {
    renderSection([concept({ nodeId: 'node-a', title: 'Deep Work', degree: 0 }), concept({ nodeId: 'node-b', title: 'Systems Thinking', degree: 5 })])
    expect(screen.getByText('0 connections')).toBeTruthy()
    expect(screen.getByText('5 connections')).toBeTruthy()
  })
})
