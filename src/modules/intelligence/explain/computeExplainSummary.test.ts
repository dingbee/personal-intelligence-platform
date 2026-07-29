import { describe, expect, it } from 'vitest'
import { computeExplainSummary } from '@/modules/intelligence/explain/computeExplainSummary'

describe('computeExplainSummary', () => {
  it('reports zero/false for an answer with no additional context', () => {
    const summary = computeExplainSummary({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      workspaceName: null,
      userQuery: 'Hello',
      model: 'claude-test',
    })
    expect(summary.documentsUsed).toBe(0)
    expect(summary.knowledgeGraphUsed).toBe(false)
    expect(summary.memoriesUsed).toBe(false)
    expect(summary.workspaceName).toBeNull()
  })

  it('reports true/counts when context was used', () => {
    const summary = computeExplainSummary({
      contextTrace: { retrievedChunks: 3, graphNodes: 2, memoriesUsed: 1 },
      workspaceName: 'Research Notes',
      userQuery: 'Explain how these connect.',
      model: 'claude-test',
    })
    expect(summary.documentsUsed).toBe(3)
    expect(summary.knowledgeGraphUsed).toBe(true)
    expect(summary.graphNodeCount).toBe(2)
    expect(summary.memoriesUsed).toBe(true)
    expect(summary.memoryCount).toBe(1)
    expect(summary.workspaceName).toBe('Research Notes')
    expect(summary.responseStyle).toBe('exploratory')
  })

  it('flags a continuation message', () => {
    const summary = computeExplainSummary({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      workspaceName: null,
      userQuery: 'continue',
      model: 'claude-test',
    })
    expect(summary.isContinuation).toBe(true)
  })

  it('carries the model through unchanged', () => {
    const summary = computeExplainSummary({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      workspaceName: null,
      userQuery: 'Hi',
      model: 'gpt-test',
    })
    expect(summary.model).toBe('gpt-test')
  })
})
