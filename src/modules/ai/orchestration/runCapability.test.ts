import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getActivePromptMock, getChatProviderMock, streamChatCompletionMock, hasFeatureMock, capabilityRegistryGetMock } = vi.hoisted(() => ({
  getActivePromptMock: vi.fn(),
  getChatProviderMock: vi.fn(),
  streamChatCompletionMock: vi.fn(async () => ({ content: 'ok', model: 'test-model' })),
  hasFeatureMock: vi.fn(),
  capabilityRegistryGetMock: vi.fn(),
}))

vi.mock('@/modules/core/prompts/registry', () => ({ getActivePrompt: getActivePromptMock }))
vi.mock('@/modules/core/prompts/renderPromptTemplate', () => ({ renderPromptTemplate: (template: string) => template }))
vi.mock('@/modules/core/capabilities/registry', () => ({ capabilityRegistry: { get: capabilityRegistryGetMock } }))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: getChatProviderMock, DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))
vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))

import { runCapability } from '@/modules/ai/orchestration/runCapability'

/**
 * Phase P0 Pro Intelligence Foundation — runCapability is the shared
 * execution point every future Advanced AI Workspace / Research /
 * Planning / Deep Academic Intelligence capability will flow through, so
 * this is where the AICapability.requiredFeature entitlement gate is
 * exercised end-to-end (Free denied, Pro/Founding Pro allowed,
 * unauthorized direct invocation denied, existing ungated capabilities
 * unaffected).
 */
describe('runCapability — Pro Intelligence entitlement gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getActivePromptMock.mockReturnValue({ template: 'Do the thing.' })
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
  })

  it('runs an ungated capability without ever checking entitlement — existing behavior unaffected', async () => {
    capabilityRegistryGetMock.mockReturnValue({ id: 'summarize', label: 'Summarize', description: 'Summarize the content.' })

    await runCapability({ capabilityId: 'summarize', variables: {}, userId: 'user-1', workspaceId: null })

    expect(hasFeatureMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('runs a capability with no registry entry at all without checking entitlement — same as an unregistered capability today', async () => {
    capabilityRegistryGetMock.mockReturnValue(undefined)

    await runCapability({ capabilityId: 'unregistered-capability', variables: {}, userId: 'user-1', workspaceId: null })

    expect(hasFeatureMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('runs a Pro-gated capability for a Pro-entitled user', async () => {
    capabilityRegistryGetMock.mockReturnValue({
      id: 'research-brief',
      label: 'Research Brief',
      description: 'Draft a research brief.',
      requiredFeature: 'pro_intelligence',
    })
    hasFeatureMock.mockResolvedValueOnce(true)

    await runCapability({ capabilityId: 'research-brief', variables: {}, userId: 'pro-user', workspaceId: null })

    expect(hasFeatureMock).toHaveBeenCalledWith('pro-user', 'pro_intelligence')
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('runs a Pro-gated capability for a Founding Pro-entitled user identically — same entitlement check, no special-casing', async () => {
    capabilityRegistryGetMock.mockReturnValue({
      id: 'research-brief',
      label: 'Research Brief',
      description: 'Draft a research brief.',
      requiredFeature: 'pro_intelligence',
    })
    hasFeatureMock.mockResolvedValueOnce(true)

    await runCapability({ capabilityId: 'research-brief', variables: {}, userId: 'founding-pro-user', workspaceId: null })

    expect(hasFeatureMock).toHaveBeenCalledWith('founding-pro-user', 'pro_intelligence')
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('denies a Free user before resolving any prompt template or provider', async () => {
    capabilityRegistryGetMock.mockReturnValue({
      id: 'research-brief',
      label: 'Research Brief',
      description: 'Draft a research brief.',
      requiredFeature: 'pro_intelligence',
    })
    hasFeatureMock.mockResolvedValueOnce(false)

    await expect(
      runCapability({ capabilityId: 'research-brief', variables: {}, userId: 'free-user', workspaceId: null }),
    ).rejects.toThrow('Research Brief requires an upgraded plan.')

    expect(getActivePromptMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
  })

  it('denies an unauthorized/direct invocation that bypasses UI gating entirely, the same server-checked way', async () => {
    capabilityRegistryGetMock.mockReturnValue({
      id: 'research-brief',
      label: 'Research Brief',
      description: 'Draft a research brief.',
      requiredFeature: 'pro_intelligence',
    })
    hasFeatureMock.mockResolvedValueOnce(false)

    await expect(
      runCapability({
        capabilityId: 'research-brief',
        variables: { anything: 'x' },
        userId: 'attacker',
        workspaceId: 'workspace-1',
        providerId: 'openai',
      }),
    ).rejects.toThrow()

    expect(streamChatCompletionMock).not.toHaveBeenCalled()
  })
})
