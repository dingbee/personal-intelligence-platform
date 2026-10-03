import { describe, expect, it } from 'vitest'
import type { AgentExecutionRequest } from './contracts'
import { MockNoVARuntimeAdapter } from './mock-adapter'
import { ValidatingNoVARuntimeAdapter, validateAgentExecutionRequest } from './adapter'

const request: AgentExecutionRequest = {
  contractVersion: '1.0.0',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  correlationId: 'run-1',
  causationId: 'recommendation-1',
  idempotencyKey: 'idem-1',
  provenanceIds: ['source-1'],
  resourceVersion: 2,
  definitionVersion: 3,
  agentId: 'agent-1',
  input: { task: 'research' },
}

describe('V2 NoVA runtime contract', () => {
  it('requires tenant, correlation and idempotency scope', () => {
    expect(() => validateAgentExecutionRequest({ ...request, organizationId: '' })).toThrow(/organization scope/)
    expect(() => validateAgentExecutionRequest({ ...request, correlationId: '' })).toThrow(/correlationId/)
    expect(() => validateAgentExecutionRequest({ ...request, idempotencyKey: '' })).toThrow(/idempotencyKey/)
  })

  it('preserves correlation and provenance through the validating adapter', async () => {
    const mock = new MockNoVARuntimeAdapter()
    const adapter = new ValidatingNoVARuntimeAdapter(mock)
    const reference = await adapter.startAgent(request)
    expect(mock.requests[0]).toEqual(request)
    expect(reference).toMatchObject({ runId: 'run-1', state: 'accepted' })
  })

  it('does not turn acceptance into success', async () => {
    const mock = new MockNoVARuntimeAdapter()
    const adapter = new ValidatingNoVARuntimeAdapter(mock)
    const reference = await adapter.startAgent(request)
    expect(reference.state).toBe('accepted')
    expect(reference.state).not.toBe('succeeded')
  })

  it('uses the same contract for workflow and tool requests', async () => {
    const mock = new MockNoVARuntimeAdapter()
    const adapter = new ValidatingNoVARuntimeAdapter(mock)
    const workflow = await adapter.startWorkflow({ ...request, workflowId: 'workflow-1' } as any)
    const tool = await adapter.invokeTool({ ...request, toolId: 'tool-1', input: { q: 'x' } } as any)
    expect(workflow.state).toBe('accepted')
    expect(tool.state).toBe('accepted')
  })
})