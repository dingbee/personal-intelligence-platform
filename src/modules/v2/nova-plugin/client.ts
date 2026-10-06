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

export interface NoVAPluginTransport {
  registerManifest(manifest: PluginManifest): Promise<void>
  negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult>
  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference>
  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference>
  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference>
  getRun(
    runId: RuntimeRunId,
    scope: Pick<CapabilityNegotiationRequest, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>,
  ): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined>
}

export class NoVAPluginApiClient implements NoVAPluginTransport {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(baseUrl: string, fetchImpl: typeof fetch = fetch) {
    if (!baseUrl.trim()) throw new Error('NoVA Core API base URL is required.')
    this.baseUrl = baseUrl
    this.fetchImpl = fetchImpl
  }

  async registerManifest(manifest: PluginManifest): Promise<void> {
    await this.request<void>('/v1/plugins/manifests', {
      method: 'POST',
      body: manifest,
    })
  }

  negotiateCapabilities(request: CapabilityNegotiationRequest): Promise<CapabilityNegotiationResult> {
    return this.request('/v1/plugin-runtime/capabilities/negotiate', { method: 'POST', body: request })
  }

  startAgent(request: AgentExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.request('/v1/plugin-runtime/agents/runs', { method: 'POST', body: request })
  }

  startWorkflow(request: WorkflowExecutionRequest): Promise<RuntimeExecutionReference> {
    return this.request('/v1/plugin-runtime/workflows/runs', { method: 'POST', body: request })
  }

  invokeTool(request: ToolInvocationRequest): Promise<RuntimeExecutionReference> {
    return this.request('/v1/plugin-runtime/tools/invocations', { method: 'POST', body: request })
  }

  getRun(
    runId: RuntimeRunId,
    scope: Pick<CapabilityNegotiationRequest, 'contractVersion' | 'organizationId' | 'workspaceId' | 'correlationId' | 'idempotencyKey'>,
  ): Promise<RuntimeExecutionReference | RuntimeExecutionResult | undefined> {
    return this.request('/v1/plugin-runtime/runs/' + encodeURIComponent(runId), {
      method: 'POST',
      body: scope,
    })
  }

  private async request<T>(
    path: string,
    options: { method: 'POST'; body: unknown },
  ): Promise<T> {
    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      method: options.method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options.body),
    })

    if (!response.ok) {
      throw new Error('NoVA Core API request failed with HTTP ' + response.status)
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}
