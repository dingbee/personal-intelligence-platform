import type {
  AgentExecutionRequest,
  CapabilityNegotiationRequest,
  CapabilityNegotiationResult,
  RuntimeExecutionReference,
  RuntimeExecutionResult,
  RuntimeRunId,
  ToolInvocationRequest,
  WorkflowExecutionRequest,
} from '../runtime/contracts'
import type { PluginManifest } from './types'

export interface NoVAPluginGatewayHeadersProvider {
  getHeaders(organizationId: string, pluginId: string): Record<string, string>
}

export interface NoVAPluginTransport {
  registerManifest(manifest: PluginManifest, organizationId: string): Promise<void>
  negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult>
  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference>
  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference>
  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference>
  getRun(
    runId: RuntimeRunId,
    scope: Pick<CapabilityNegotiationRequest, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>,
  ): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined>
}

/**
 * Transport for NoVA Core's P0-4 external plugin gateway.
 *
 * Credentials are deliberately supplied by the host through a headers
 * provider. This class never stores or discovers a NoVA secret itself and
 * must not be instantiated in browser code with a long-lived gateway secret.
 */
export class NoVAPluginApiClient implements NoVAPluginTransport {
  private readonly gatewayUrl: URL
  private readonly pluginId: string
  private readonly headersProvider: NoVAPluginGatewayHeadersProvider
  private readonly fetchImpl: typeof fetch

  constructor(
    baseUrl: string,
    pluginId: string,
    headersProvider: NoVAPluginGatewayHeadersProvider,
    fetchImpl: typeof fetch = fetch,
  ) {
    if (!baseUrl.trim()) throw new Error('NoVA Core gateway base URL is required.')
    if (!pluginId.trim()) throw new Error('NoVA plugin id is required.')
    this.gatewayUrl = new URL('/api/public/core/plugin-gateway', baseUrl)
    this.pluginId = pluginId
    this.headersProvider = headersProvider
    this.fetchImpl = fetchImpl
  }

  async registerManifest(manifest: PluginManifest, organizationId: string): Promise<void> {
    await this.post(organizationId, { action: 'register', manifest })
  }

  negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult> {
    return this.post(request.organizationId, {
      action: 'negotiate',
      capabilities: request.requestedCapabilities,
    })
  }

  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.post(request.organizationId, {
      action: 'agent.run',
      agentId: request.agentId,
      userInput: typeof request.input?.userInput === 'string' ? request.input.userInput : JSON.stringify(request.input ?? {}),
      userId: typeof request.input?.userId === 'string' ? request.input.userId : undefined,
      subjectId: typeof request.input?.subjectId === 'string' ? request.input.subjectId : undefined,
      input: request.input,
      contextIds: request.contextIds,
      approvalId: request.approvalId,
      capabilities: request.capabilities,
      correlationId: request.correlationId,
      causationId: request.causationId,
      idempotencyKey: request.idempotencyKey,
    })
  }

  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.post(request.organizationId, {
      action: 'workflow.run',
      workflowId: request.workflowId,
      userId: typeof request.input?.userId === 'string' ? request.input.userId : undefined,
      input: request.input,
      approvalId: request.approvalId,
      capabilities: request.capabilities,
      correlationId: request.correlationId,
      causationId: request.causationId,
      idempotencyKey: request.idempotencyKey,
    })
  }

  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference> {
    return this.post(request.organizationId, {
      action: 'tool.invoke',
      toolId: request.toolId,
      userId: typeof request.authorization.agentId === 'string' ? request.authorization.agentId : undefined,
      input: request.input,
      approved: request.authorization.decision === 'authorized',
      approvalId: request.authorization.approvalId,
      correlationId: request.correlationId,
      causationId: request.causationId,
      idempotencyKey: request.idempotencyKey,
      authorization: request.authorization,
    })
  }

  async getRun(
    runId: RuntimeRunId,
    scope: Pick<CapabilityNegotiationRequest, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>,
  ): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined> {
    if (!runId) throw new Error('NoVA runtime lookup requires runId.')
    const response = await this.fetchImpl(
      new URL(this.gatewayUrl.toString() + '?runId=' + encodeURIComponent(runId)),
      {
        method: 'GET',
        headers: this.headersProvider.getHeaders(scope.organizationId, this.pluginId),
      },
    )
    return this.parseResponse(response, scope.organizationId)
  }

  private async post<T>(organizationId: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(this.gatewayUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headersProvider.getHeaders(organizationId, this.pluginId),
      },
      body: JSON.stringify(body),
    })
    return this.parseResponse(response, organizationId) as Promise<T>
  }

  private async parseResponse<T>(response: Response, organizationId: string): Promise<T> {
    const body = await response.json().catch(() => undefined)
    if (!response.ok) {
      throw new Error(
        'NoVA Core gateway request failed with HTTP ' + response.status +
        (body && typeof body === 'object' && 'error' in body ? ': ' + String(body.error) : ''),
      )
    }

    if (body && typeof body === 'object' && 'error' in body && body.error) {
      throw new Error('NoVA Core gateway rejected the request for organization ' + organizationId + ': ' + String(body.error))
    }

    return body as T
  }
}
