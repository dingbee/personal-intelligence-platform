import { describe, expect, it } from 'vitest'
import { buildGraphContextText, type GraphContextLink, type GraphContextNode } from '@/modules/knowledge-intelligence/api/retrieveGraphContext'

describe('buildGraphContextText', () => {
  it('returns null when there are no nodes', () => {
    expect(buildGraphContextText([], [], ['Physics Handbook'])).toBeNull()
  })

  it('formats a concept with no relationships and no "Related to" section', () => {
    const nodes: GraphContextNode[] = [{ id: 'n1', title: 'Relativity Theory', node_type: 'concept' }]
    const text = buildGraphContextText(nodes, [], [])
    expect(text).toBe('Knowledge connections:\n\nConcept: Relativity Theory')
  })

  it('lists related node titles reached via a link, from either direction', () => {
    const nodes: GraphContextNode[] = [
      { id: 'n1', title: 'Relativity Theory', node_type: 'concept' },
      { id: 'n2', title: 'Gravity', node_type: 'concept' },
      { id: 'n3', title: 'Space-time', node_type: 'concept' },
    ]
    const links: GraphContextLink[] = [
      { source_id: 'n1', target_id: 'n2', relationship_type: 'relates_to' },
      { source_id: 'n3', target_id: 'n1', relationship_type: 'relates_to' },
    ]
    const text = buildGraphContextText(nodes, links, [])
    expect(text).toContain('Concept: Relativity Theory\nRelated to:\n- Gravity\n- Space-time')
  })

  it('labels entities distinctly from concepts', () => {
    const nodes: GraphContextNode[] = [{ id: 'n1', title: 'Einstein', node_type: 'entity' }]
    const text = buildGraphContextText(nodes, [], [])
    expect(text).toBe('Knowledge connections:\n\nEntity: Einstein')
  })

  it('appends a deduplicated Sources section when source titles are given', () => {
    const nodes: GraphContextNode[] = [{ id: 'n1', title: 'Relativity Theory', node_type: 'concept' }]
    const text = buildGraphContextText(nodes, [], ['Physics Handbook', 'Einstein Notes', 'Physics Handbook'])
    expect(text).toBe('Knowledge connections:\n\nConcept: Relativity Theory\n\nSources:\n- Physics Handbook\n- Einstein Notes')
  })

  it('omits the Sources section entirely when no source titles are given', () => {
    const nodes: GraphContextNode[] = [{ id: 'n1', title: 'Relativity Theory', node_type: 'concept' }]
    const text = buildGraphContextText(nodes, [], [])
    expect(text).not.toContain('Sources:')
  })

  it('skips a link whose other endpoint is not among the given nodes', () => {
    const nodes: GraphContextNode[] = [{ id: 'n1', title: 'Relativity Theory', node_type: 'concept' }]
    const links: GraphContextLink[] = [{ source_id: 'n1', target_id: 'unknown', relationship_type: 'relates_to' }]
    const text = buildGraphContextText(nodes, links, [])
    expect(text).toBe('Knowledge connections:\n\nConcept: Relativity Theory')
  })

  it('formats multiple nodes as separate blocks', () => {
    const nodes: GraphContextNode[] = [
      { id: 'n1', title: 'Relativity Theory', node_type: 'concept' },
      { id: 'n2', title: 'Einstein', node_type: 'entity' },
    ]
    const text = buildGraphContextText(nodes, [], [])
    expect(text).toBe('Knowledge connections:\n\nConcept: Relativity Theory\n\nEntity: Einstein')
  })
})
