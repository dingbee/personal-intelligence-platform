import { beforeAll, describe, expect, it } from 'vitest'
import { commandRegistry } from '@/modules/commands/registry'
import { deriveActionSuggestions } from '@/modules/intelligence/orchestrator/suggestionEngine'
import type { Command, CommandContext } from '@/modules/commands/types'

function baseContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: 'w1',
    workspaceName: 'Research',
    pathname: '/chat',
    documentId: null,
    inProgressDocument: null,
    ...overrides,
  }
}

function testCommand(id: string): Command {
  return { id, title: id, icon: '•', category: 'navigation', execute: () => {} }
}

beforeAll(() => {
  for (const id of ['notes-create', 'search-open', 'workspace-manage', 'memory-manage']) {
    commandRegistry.register(testCommand(id))
  }
})

describe('deriveActionSuggestions', () => {
  it('always includes the curated action chips', () => {
    const suggestions = deriveActionSuggestions({
      commandContext: baseContext(),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: null,
    })
    expect(suggestions.map((s) => s.command.id)).toEqual(expect.arrayContaining(['notes-create', 'search-open']))
  })

  it('offers "Explore knowledge graph" only when the graph contributed this turn', () => {
    const without = deriveActionSuggestions({
      commandContext: baseContext(),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: null,
    })
    expect(without.some((s) => s.command.id === 'knowledge-explore')).toBe(false)

    const withGraph = deriveActionSuggestions({
      commandContext: baseContext(),
      hasGraphContext: true,
      relatedConversation: null,
      mostActiveWorkspace: null,
    })
    expect(withGraph.some((s) => s.command.id === 'knowledge-explore')).toBe(true)
  })

  it('offers a resume-conversation suggestion only when one is provided', () => {
    const suggestions = deriveActionSuggestions({
      commandContext: baseContext(),
      hasGraphContext: false,
      relatedConversation: { id: 'conv-1', title: 'Marketing plan' },
      mostActiveWorkspace: null,
    })
    const found = suggestions.find((s) => s.command.id === 'conversation-resume-conv-1')
    expect(found).toBeDefined()
    expect(found?.reason).toContain('Marketing plan')
  })

  it('offers a workspace-switch suggestion only when the most active workspace differs from the current one', () => {
    const same = deriveActionSuggestions({
      commandContext: baseContext({ workspaceId: 'w1' }),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: { id: 'w1', name: 'Research' },
    })
    expect(same.some((s) => s.command.id.startsWith('workspace-switch'))).toBe(false)

    const different = deriveActionSuggestions({
      commandContext: baseContext({ workspaceId: 'w1' }),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: { id: 'w2', name: 'Archive' },
    })
    expect(different.some((s) => s.command.id === 'workspace-switch-w2')).toBe(true)
  })
})
