import { describe, expect, it } from 'vitest'
import { validateWorkflowDefinitionClient, type V2WorkflowDefinition } from './workflowStudio'

const base: V2WorkflowDefinition = {
  version: 1,
  trigger: { type: 'manual', config: {} },
  nodes: [
    { id: 'start', type: 'start', config: {}, next: ['agent'] },
    { id: 'agent', type: 'agent', config: { agentId: 'agent-1' }, next: ['approval'] },
    { id: 'approval', type: 'approval', config: { mode: 'human' }, next: [] },
  ],
}

describe('V2 Workflow Studio graph contract', () => {
  it('accepts a structurally valid declarative graph', () => {
    expect(validateWorkflowDefinitionClient(base)).toEqual([])
  })

  it('rejects duplicate node ids and dangling edges', () => {
    const invalid = {
      ...base,
      nodes: [
        { id: 'start', type: 'start', config: {}, next: ['missing'] },
        { id: 'start', type: 'understand', config: {}, next: [] },
      ],
    } as V2WorkflowDefinition

    expect(validateWorkflowDefinitionClient(invalid)).toEqual(expect.arrayContaining([
      'Duplicate node id: start',
      'Node start references missing node missing.',
    ]))
  })

  it('rejects cyclic graphs before save', () => {
    const cyclic: V2WorkflowDefinition = {
      ...base,
      nodes: [
        { id: 'start', type: 'start', config: {}, next: ['a'] },
        { id: 'a', type: 'understand', config: {}, next: ['b'] },
        { id: 'b', type: 'verify', config: {}, next: ['a'] },
      ],
    }

    expect(validateWorkflowDefinitionClient(cyclic)).toContain('Workflow graph cannot contain cycles.')
  })

  it('requires exactly one start node', () => {
    const invalid = {
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, type: node.type === 'start' ? 'understand' : node.type })),
    } as V2WorkflowDefinition

    expect(validateWorkflowDefinitionClient(invalid)).toContain('Workflow requires exactly one start node.')
  })

  it('requires governed dependencies for agent, tool, approval and action nodes', () => {
    const invalid: V2WorkflowDefinition = {
      ...base,
      nodes: [
        { id: 'start', type: 'start', config: {}, next: ['agent'] },
        { id: 'agent', type: 'agent', config: {}, next: ['tool'] },
        { id: 'tool', type: 'tool', config: {}, next: ['approval'] },
        { id: 'approval', type: 'approval', config: { mode: 'unknown' }, next: ['action'] },
        { id: 'action', type: 'action', config: {}, next: [] },
      ],
    }

    const errors = validateWorkflowDefinitionClient(invalid)
    expect(errors).toEqual(expect.arrayContaining([
      'Agent node agent requires agentId.',
      'Tool node tool requires toolId.',
      'Approval node approval requires human or policy mode.',
      'Action node action requires actionId.',
    ]))
  })
})
