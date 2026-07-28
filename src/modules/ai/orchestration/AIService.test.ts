import { beforeAll, describe, expect, it, vi } from 'vitest'
import { promptRegistry } from '@/modules/core/prompts/registry'

// vi.mock calls are hoisted above these imports by Vitest — vi.hoisted is
// what lets a mock factory safely close over a variable this file also
// asserts against later (retrieveMemoryContextMock).
const { retrieveMemoryContextMock, retrieveGraphContextMock, retrieveContextMock, streamChatCompletionMock } =
  vi.hoisted(() => ({
    retrieveMemoryContextMock: vi.fn(async () => null as string | null),
    retrieveGraphContextMock: vi.fn(async () => null as string | null),
    retrieveContextMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string; similarity: number }[]),
    streamChatCompletionMock: vi.fn(async (_params: { system: string }) => ({ content: 'Hello there.', model: 'test-model' })),
  }))

vi.mock('@/modules/ai/chat/api/messages', () => ({
  insertMessage: vi.fn(
    async (params: { conversationId: string; userId: string; role: string; content: string; contextChunkIds?: string[] }) => ({
      id: `message-${Math.random()}`,
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      context_chunk_ids: params.contextChunkIds ?? [],
      created_at: new Date().toISOString(),
    }),
  ),
}))
vi.mock('@/modules/ai/chat/api/conversations', () => ({ touchConversation: vi.fn(async () => {}) }))
vi.mock('@/modules/search/indexing/indexMessage', () => ({ indexMessage: vi.fn(async () => {}) }))
vi.mock('@/modules/ai/orchestration/retrieveContext', () => ({ retrieveContext: retrieveContextMock }))
vi.mock('@/modules/knowledge-intelligence/api/retrieveGraphContext', () => ({ retrieveGraphContext: retrieveGraphContextMock }))
vi.mock('@/modules/ai/memory/retrieveMemoryContext', () => ({ retrieveMemoryContext: retrieveMemoryContextMock }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))

// getChatProvider/the real chat provider instances aren't mocked — they're
// plain, hardcoded objects (see providers/registry.ts), and since
// streamChatCompletion is mocked above, `provider.chat()` never actually
// runs, so using the real registry here carries no network risk.
import { sendMessage } from '@/modules/ai/orchestration/AIService'

beforeAll(() => {
  promptRegistry.register({
    id: 'test-chat@1.0',
    capabilityId: 'chat',
    version: '1.0',
    active: true,
    template: 'Context:\n{{context}}',
  })
})

function baseParams() {
  return {
    conversationId: 'conv-1',
    userId: 'user-1',
    workspaceId: 'workspace-1' as string | null,
    providerChain: ['anthropic'],
    history: [],
    text: 'What have I learned about hospitality?',
  }
}

describe('sendMessage', () => {
  it('calls retrieveMemoryContext with the userId/workspaceId, wiring it into the request exactly like retrieveGraphContext', async () => {
    await sendMessage(baseParams())
    expect(retrieveMemoryContextMock).toHaveBeenCalledWith({ userId: 'user-1', workspaceId: 'workspace-1' })
  })

  it('completes and returns the assistant reply even when memory retrieval yields nothing (its documented failure behavior is returning null, never throwing)', async () => {
    retrieveMemoryContextMock.mockResolvedValueOnce(null)
    const message = await sendMessage(baseParams())
    expect(message.content).toBe('Hello there.')
  })

  it('still completes successfully when graph context is also absent — memory is not the only optional block', async () => {
    retrieveMemoryContextMock.mockResolvedValueOnce(null)
    retrieveGraphContextMock.mockResolvedValueOnce(null)
    const message = await sendMessage(baseParams())
    expect(message.content).toBe('Hello there.')
  })

  it('passes the retrieved memory context through to the system prompt sent to the provider', async () => {
    retrieveMemoryContextMock.mockResolvedValueOnce('## Learned preferences\n- Likes concise answers')
    await sendMessage(baseParams())
    const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
    expect(lastCall?.system).toContain('<personal_context>')
    expect(lastCall?.system).toContain('Likes concise answers')
  })
})
