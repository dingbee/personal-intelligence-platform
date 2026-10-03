import { describe, expect, it } from 'vitest'
import type { AgentExecutionRequest, ToolInvocationRequest, WorkflowExecutionRequest } from './contracts'
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
    expect(() => validateAgentExecutionRequest({ ...request, contractVersion: '2.0.0' as '1.0.0' })).toThrow(/contract version/)
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

  it('fails closed for unsupported runtime capabilities', async () => {
    const mock = new MockNoVARuntimeAdapter()
    const adapter = new ValidatingNoVARuntimeAdapter(mock)
    const result = await adapter.negotiateCapabilities({
      contractVersion: '1.0.0',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      correlationId: 'run-2',
      idempotencyKey: 'idem-2',
      requestedCapabilities: ['agent.execute', 'unsupported.capability'],
    })
    expect(result.supported).toEqual(['agent.execute'])
    expect(result.rejected).toEqual(['unsupported.capability'])
  })

  it('keeps approval correlation explicit', async () => {
    const mock = new MockNoVARuntimeAdapter()
    const adapter = new ValidatingNoVARuntimeAdapter(mock)
    const approval = await adapter.requestApproval({
      ...request,
      approvalId: 'approval-1',
      subjectType: 'action',
      subjectId: 'action-1',
      requestedBy: 'user-1',
    })
    const decision = await adapter.resolveApproval({
      ...request,
      approvalId: approval.approvalId,
      decision: 'approved',
      decidedBy: 'user-1',
      decidedAt: '2026-10-03T03:00:00Z',
    })
    expect(decision.approvalId).toBe('approval-1')
  })

  it('uses the same contract for workflow and tool requests', async () => {
    const mock = new MockNoVARuntimeAdapter()
    const adapter = new ValidatingNoVARuntimeAdapter(mock)
    const workflow: WorkflowExecutionRequest = { ...request, workflowId: 'workflow-1' }
    const tool: ToolInvocationRequest = { ...request, toolId: 'tool-1', input: { q: 'x' } }
    const workflowReference = await adapter.startWorkflow(workflow)
    const toolReference = await adapter.invokeTool(tool)
    expect(workflowReference.state).toBe('accepted')
    expect(toolReference.state).toBe('accepted')
  })
})