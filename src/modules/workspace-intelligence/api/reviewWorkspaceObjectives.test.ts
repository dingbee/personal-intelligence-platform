import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/workspace-intelligence/module'

const { getWorkspaceMock, listWorkspaceObjectivesMock, buildWorkspaceHubStateMock, hasFeatureMock, streamChatCompletionMock } = vi.hoisted(() => ({
  getWorkspaceMock: vi.fn(),
  listWorkspaceObjectivesMock: vi.fn(),
  buildWorkspaceHubStateMock: vi.fn(),
  hasFeatureMock: vi.fn(),
  streamChatCompletionMock: vi.fn(async () => ({ content: 'Objective 1 has supporting evidence, but pricing evidence remains unresolved.', model: 'test-model' })),
}))

vi.mock('@/modules/workspaces/api/workspaces', () => ({ getWorkspace: getWorkspaceMock }))
vi.mock('@/modules/hub/api/objectives', () => ({ listWorkspaceObjectives: listWorkspaceObjectivesMock }))
vi.mock('@/modules/hub/hubData', () => ({ buildWorkspaceHubState: buildWorkspaceHubStateMock }))
vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: vi.fn(() => ({ id: 'anthropic' })), DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))

import { reviewWorkspaceObjectives } from '@/modules/workspace-intelligence/api/reviewWorkspaceObjectives'

const workspace = { id: 'workspace-1', user_id: 'user-1', name: 'Research', archived_at: null, sort_order: 0, created_at: '', updated_at: '' }
const commandContext = { userId: 'user-1', workspaceId: 'workspace-1', workspaceName: 'Research', pathname: '/hub', documentId: null, inProgressDocument: null }
const hub = {
  report: { maturity: { label: 'Developing', reason: 'Knowledge is growing', stage: 'developing' } },
  activeConcepts: [], gaps: [{ message: 'Pricing evidence remains unresolved' }], recommendations: [], recentNotes: [], activeConversations: [],
}

describe('reviewWorkspaceObjectives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getWorkspaceMock.mockResolvedValue(workspace)
    listWorkspaceObjectivesMock.mockResolvedValue([{ id: 'o1', workspace_id: 'workspace-1', user_id: 'user-1', content: 'Complete research', status: 'active', created_at: '', updated_at: '' }])
    buildWorkspaceHubStateMock.mockResolvedValue(hub)
  })

  it('denies Free before any AI completion', async () => {
    hasFeatureMock.mockResolvedValueOnce(false)
    await expect(reviewWorkspaceObjectives({ workspaceId: 'workspace-1', userId: 'free-user', commandContext, chain: ['anthropic'] })).rejects.toThrow('requires an upgraded plan')
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
  })

  it('reviews objectives for Pro without changing objective state', async () => {
    hasFeatureMock.mockResolvedValueOnce(true)
    const result = await reviewWorkspaceObjectives({ workspaceId: 'workspace-1', userId: 'pro-user', commandContext, chain: ['anthropic'] })
    expect(result).toContain('supporting evidence')
    expect(streamChatCompletionMock).toHaveBeenCalledWith(expect.objectContaining({ system: expect.stringContaining('Complete research') as unknown as string }))
    expect(listWorkspaceObjectivesMock).toHaveBeenCalledWith('workspace-1')
  })
})
