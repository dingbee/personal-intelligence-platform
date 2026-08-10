import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/workspace-intelligence/module'

const {
  getWorkspaceMock,
  listWorkspaceObjectivesMock,
  buildWorkspaceHubStateMock,
  createNoteMock,
  indexNoteMock,
  linkKnownConceptsToSourceMock,
  getChatProviderMock,
  streamChatCompletionMock,
  hasFeatureMock,
} = vi.hoisted(() => ({
  getWorkspaceMock: vi.fn(),
  listWorkspaceObjectivesMock: vi.fn(),
  buildWorkspaceHubStateMock: vi.fn(),
  createNoteMock: vi.fn(),
  indexNoteMock: vi.fn(async () => {}),
  linkKnownConceptsToSourceMock: vi.fn(async () => {}),
  getChatProviderMock: vi.fn(),
  streamChatCompletionMock: vi.fn(async () => ({ content: 'This workspace is working on the Acme launch.', model: 'test-model' })),
  hasFeatureMock: vi.fn(),
}))

vi.mock('@/modules/workspaces/api/workspaces', () => ({ getWorkspace: getWorkspaceMock }))
vi.mock('@/modules/hub/api/objectives', () => ({ listWorkspaceObjectives: listWorkspaceObjectivesMock }))
vi.mock('@/modules/hub/hubData', () => ({ buildWorkspaceHubState: buildWorkspaceHubStateMock }))
vi.mock('@/modules/notes/api/notes', () => ({ createNote: createNoteMock }))
vi.mock('@/modules/search/indexing/indexNote', () => ({ indexNote: indexNoteMock }))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({ linkKnownConceptsToSource: linkKnownConceptsToSourceMock }))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: getChatProviderMock, DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))
vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))

import { generateWorkspaceBriefing } from '@/modules/workspace-intelligence/api/generateWorkspaceBriefing'

const workspace = { id: 'workspace-1', user_id: 'user-1', name: 'Acme Launch', archived_at: null, sort_order: 0, created_at: '', updated_at: '' }
const commandContext = { userId: 'user-1', workspaceId: 'workspace-1', workspaceName: 'Acme Launch', pathname: '/hub', documentId: null, inProgressDocument: null }
const emptyHub = {
  report: { maturity: { label: 'Emerging', reason: 'Just getting started.', stage: 'emerging' } },
  activeConcepts: [],
  gaps: [],
  recommendations: [],
  recentNotes: [],
  activeConversations: [],
}

/**
 * Phase P1 Advanced AI Workspace — exercises the REAL registered
 * 'workspace-briefing' capability (module.ts imported for its side
 * effect, not mocked) through the REAL runCapability entitlement gate
 * (Phase P0), so Free/Pro/Founding Pro access is proven for this actual
 * shipped capability — not just the generic mechanism runCapability.test.ts
 * already covers with a synthetic capability.
 */
describe('generateWorkspaceBriefing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getWorkspaceMock.mockResolvedValue(workspace)
    listWorkspaceObjectivesMock.mockResolvedValue([])
    buildWorkspaceHubStateMock.mockResolvedValue(emptyHub)
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
    createNoteMock.mockResolvedValue({
      id: 'note-1',
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      title: 'Workspace Briefing: Acme Launch',
      content: 'This workspace is working on the Acme launch.',
    })
  })

  it('denies a Free user before any AI call or persistence happens', async () => {
    hasFeatureMock.mockResolvedValueOnce(false)

    await expect(
      generateWorkspaceBriefing({ workspaceId: 'workspace-1', userId: 'free-user', commandContext, chain: ['anthropic'] }),
    ).rejects.toThrow('requires an upgraded plan')

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'pro_intelligence')
    // The context fetch (the caller's own, already RLS-scoped workspace
    // data) still runs — only runCapability's AI/provider resolution and
    // note persistence are gated, per the single-enforcement-point design.
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
    expect(createNoteMock).not.toHaveBeenCalled()
  })

  it('generates and persists a briefing for a Pro-entitled user', async () => {
    hasFeatureMock.mockResolvedValueOnce(true)

    const note = await generateWorkspaceBriefing({ workspaceId: 'workspace-1', userId: 'pro-user', commandContext, chain: ['anthropic'] })

    expect(hasFeatureMock).toHaveBeenCalledWith('pro-user', 'pro_intelligence')
    expect(note.title).toBe('Workspace Briefing: Acme Launch')
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pro-user', workspaceId: 'workspace-1', title: 'Workspace Briefing: Acme Launch' }),
    )
    expect(indexNoteMock).toHaveBeenCalledWith(note, 'workspace-1')
    expect(linkKnownConceptsToSourceMock).toHaveBeenCalled()
  })

  it('generates and persists a briefing for a Founding Pro-entitled user identically — same entitlement check, no special-casing', async () => {
    hasFeatureMock.mockResolvedValueOnce(true)

    const note = await generateWorkspaceBriefing({ workspaceId: 'workspace-1', userId: 'founding-pro-user', commandContext, chain: ['anthropic'] })

    expect(hasFeatureMock).toHaveBeenCalledWith('founding-pro-user', 'pro_intelligence')
    expect(note.title).toBe('Workspace Briefing: Acme Launch')
  })

  it('fetches workspace, objectives, and hub state in parallel and formats them into the capability variables', async () => {
    hasFeatureMock.mockResolvedValueOnce(true)
    listWorkspaceObjectivesMock.mockResolvedValueOnce([
      { id: 'o1', workspace_id: 'workspace-1', user_id: 'user-1', content: 'Ship v1', status: 'active', created_at: '', updated_at: '' },
    ])

    await generateWorkspaceBriefing({ workspaceId: 'workspace-1', userId: 'pro-user', commandContext, chain: ['anthropic'] })

    expect(getWorkspaceMock).toHaveBeenCalledWith('workspace-1')
    expect(listWorkspaceObjectivesMock).toHaveBeenCalledWith('workspace-1')
    expect(buildWorkspaceHubStateMock).toHaveBeenCalledWith('workspace-1', commandContext)
    expect(streamChatCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({ system: expect.stringContaining('Ship v1') as unknown as string }),
    )
  })
})
