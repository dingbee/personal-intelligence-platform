import { describe, expect, it, vi } from 'vitest'
import { V2KnowledgeMemoryBridge } from './bridge'
import type { KnowledgeMemoryAdapter } from './contracts'

describe('V2KnowledgeMemoryBridge', () => {
  it('combines existing knowledge and memory sources without owning persistence', async () => {
    const adapter: KnowledgeMemoryAdapter = {
      retrieveKnowledge: vi.fn().mockResolvedValue({
        references: [{
          id: 'k1',
          organizationId: 'org1',
          workspaceId: 'ws1',
          kind: 'document',
          title: 'Strategy',
          source: { type: 'document', id: 'doc1', title: 'Strategy' },
          provenance: [],
        }],
        query: { organizationId: 'org1', workspaceId: 'ws1', query: 'strategy' },
        retrievedAt: '2026-10-03T00:00:00.000Z',
      }),
      retrieveMemory: vi.fn().mockResolvedValue([{
        id: 'm1',
        organizationId: 'org1',
        workspaceId: 'ws1',
        scope: 'workspace',
        scopeId: 'ws1',
        key: 'priority',
        value: 'growth',
        lifecycle: 'active',
      }]),
    }

    const bridge = new V2KnowledgeMemoryBridge(adapter)
    const context = await bridge.buildContext(
      { organizationId: 'org1', workspaceId: 'ws1', query: 'strategy' },
      { organizationId: 'org1', workspaceId: 'ws1', userId: 'u1', query: 'strategy' },
    )

    expect(context.knowledge).toHaveLength(1)
    expect(context.memories).toHaveLength(1)
    expect(adapter.retrieveKnowledge).toHaveBeenCalledOnce()
    expect(adapter.retrieveMemory).toHaveBeenCalledOnce()
  })
})
