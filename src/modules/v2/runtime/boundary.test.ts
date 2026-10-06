import { describe, expect, it } from 'vitest'
import { MockNoVARuntimeAdapter } from './mock-adapter'
import {
  assertRuntimeScope,
  assertWorkspaceConsistency,
  type AgentExecutionRequest,
  type ToolInvocationRequest,
  type WorkflowExecutionRequest,
} from './contracts'
import { validateAgentExecutionRequest, validateRuntimeRequest, validateToolInvocationRequest, validateWorkflowExecutionRequest } from './adapter'

const scope = {
  contractVersion: '1.0.0' as const,
  organizationId: 'org-1',
  workspaceId: 'workspace-1',
  correlationId: 'correlation-1',
  idempotencyKey: 'idem-1',
}

const agentRequest: AgentExecutionRequest = {
  ...scope,
  agentId: 'agent-1',
  input: { userInput: 'hello' },
}

const workflowRequest: WorkflowExecutionRequest = {
  ...scope,
  workflowId: 'workflow-1',
  input: { source: 'test' },
}

const toolRequest: ToolInvocationRequest = {
  ...scope,
  toolId: 'tool-1',
  input: { amount: 1 },
  authorization: {
    organizationId: 'org-1',
    workspaceId: 'workspace-1',
    agentId: 'agent-1',
    actionId: 'action-1',
    toolId: 'tool-1',
    requestedAutonomy: 'prepare',
    agentAutonomyCeiling: 'prepare',
    decision: 'authorized',
    requiresApproval: false,
    contextIds: ['context-1'],
    provenanceIds: ['provenance-1'],
    correlationId: 'correlation-1',
  },
}

describe('V2-08 NoVA runtime boundary verification', () => {
  it('fails closed when contract version is unsupported', () => {
    expect(() => assertRuntimeScope({ ...scope, contractVersion: '9.9.9' as never })).toThrow('Unsupported NoVA runtime contract version')
  })

  it('fails closed when organization scope is missing', () => {
    expect(() => assertRuntimeScope({ ...scope, organizationId: '' })).toThrow('organization scope')
  })

  it('fails closed when correlation or idempotency scope is missing', () => {
    expect(() => validateRuntimeRequest({ ...scope, correlationId: '' })).toThrow('correlationId')
    expect(() => validateRuntimeRequest({ ...scope, idempotencyKey: '' })).toThrow('idempotencyKey')
  })

  it('fails closed when workspace scope is explicitly empty', () => {
    expect(() => assertWorkspaceConsistency({ ...scope, workspaceId: '' })).toThrow('workspace scope cannot be empty')
  })

  it('validates agent and workflow requests independently of execution', () => {
    expect(() => validateAgentExecutionRequest(agentRequest)).not.toThrow()
    expect(() => validateWorkflowExecutionRequest(workflowRequest)).not.toThrow()
    expect(() => validateAgentExecutionRequest({ ...agentRequest, agentId: '' })).toThrow('agentId')
    expect(() => validateWorkflowExecutionRequest({ ...workflowRequest, workflowId: '' })).toThrow('workflowId')
  })

  it('fails closed when a tool authorization crosses organization, workspace, tool or correlation scope', () => {
    expect(() => validateToolInvocationRequest({
      ...toolRequest,
      authorization: { ...toolRequest.authorization, organizationId: 'other-org' },
    })).toThrow('organization does not match')

    expect(() => validateToolInvocationRequest({
      ...toolRequest,
      authorization: { ...toolRequest.authorization, workspaceId: 'other-workspace' },
    })).toThrow('workspace does not match')

    expect(() => validateToolInvocationRequest({
      ...toolRequest,
      toolId: 'tool-2',
    })).toThrow('tool does not match')

    expect(() => validateToolInvocationRequest({
      ...toolRequest,
      correlationId: 'other-correlation',
    })).toThrow('correlationId does not match')
  })

  it('requires authoritative approval metadata for consequential tool invocation', () => {
    expect(() => validateToolInvocationRequest({
      ...toolRequest,
      authorization: {
        ...toolRequest.authorization,
        requiresApproval: true,
        approvalId: undefined,
      },
    })).toThrow('approval reference')
  })

  it('rejects an authorization envelope that is not authorized', () => {
    expect(() => validateToolInvocationRequest({
      ...toolRequest,
      authorization: {
        ...toolRequest.authorization,
        decision: 'requires_approval',
      },
    })).toThrow('authorized governance envelope')
  })

  it('preserves correlation, provenance and tenant scope through the contract-only adapter', async () => {
    const adapter = new MockNoVARuntimeAdapter()
    const reference = await adapter.startAgent(agentRequest)

    expect(reference.state).toBe('accepted')
    expect(adapter.requests[0]).toMatchObject({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      correlationId: 'correlation-1',
      idempotencyKey: 'idem-1',
    })

    const stored = await adapter.getRun(reference.runId, scope)
    expect(stored).toMatchObject({ runId: reference.runId, state: 'accepted' })
  })

  it('does not convert an execution acknowledgement into a success outcome', async () => {
    const adapter = new MockNoVARuntimeAdapter()
    const reference = await adapter.startWorkflow(workflowRequest)

    expect(reference.state).toBe('accepted')
    expect(reference).not.toHaveProperty('output')
  })

  it('rejects unsupported capabilities rather than silently accepting them', async () => {
    const adapter = new MockNoVARuntimeAdapter()
    const result = await adapter.negotiateCapabilities({
      ...scope,
      requestedCapabilities: ['core.agent.run', 'core.workflow.run', 'unknown.capability'],
    })

    expect(result.supported).toEqual(['core.agent.run', 'core.workflow.run'])
    expect(result.rejected).toEqual(['unknown.capability'])
  })
})
