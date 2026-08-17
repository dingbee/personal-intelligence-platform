import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { commandRegistry } from '@/modules/commands/registry'
import { SuggestedCommandActions } from '@/modules/intelligence/components/SuggestedCommandActions'
import type { CommandActions, CommandContext } from '@/modules/commands/types'

function baseContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    workspaceName: 'My Workspace',
    pathname: '/chat',
    documentId: null,
    inProgressDocument: null,
    ...overrides,
  }
}

function baseActions(overrides: Partial<CommandActions> = {}): CommandActions {
  return {
    navigate: vi.fn(),
    setCurrentWorkspaceId: vi.fn(),
    createNote: vi.fn(async () => ({ id: 'note-1' })),
    createConversationWithQuery: vi.fn(async () => ({ id: 'conv-1' })),
    createConversationWithNoteAnalysis: vi.fn(async () => ({ id: 'conv-1' })),
    openQuickCapture: vi.fn(),
    ...overrides,
  }
}

// Same pattern deriveActionChips.test.ts already uses: the real registry is
// only populated by registerBuiltInCommands.ts's app-level side-effect
// import, so this file registers its own matching-id commands instead,
// relying on Vitest's per-test-file module isolation for a fresh registry.
const NOTES_CREATE_EXECUTE = vi.fn()
const KNOWLEDGE_EXPLORE_EXECUTE = vi.fn()

beforeAll(() => {
  commandRegistry.register({
    id: 'notes-create',
    title: 'Create note',
    icon: '📝',
    category: 'notes',
    execute: NOTES_CREATE_EXECUTE,
  })
  commandRegistry.register({
    id: 'knowledge-explore',
    title: 'Explore knowledge graph',
    icon: '🕸️',
    category: 'ai',
    execute: KNOWLEDGE_EXPLORE_EXECUTE,
  })
  // Registered but gated unavailable in the current context — proves
  // isAvailable is honored, not just registry presence.
  commandRegistry.register({
    id: 'memory-manage',
    title: 'Manage memories',
    icon: '💭',
    category: 'memory',
    isAvailable: (context) => context.workspaceId !== null,
    execute: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  NOTES_CREATE_EXECUTE.mockClear()
  KNOWLEDGE_EXPLORE_EXECUTE.mockClear()
})

describe('SuggestedCommandActions', () => {
  it('renders nothing when suggestedCommandIds is empty', () => {
    const { container } = render(
      createElement(SuggestedCommandActions, { commandIds: [], context: baseContext(), actions: baseActions() }),
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a real action for a single valid command id, with the label coming from the registry (not a duplicated string)', () => {
    render(
      createElement(SuggestedCommandActions, {
        commandIds: ['notes-create'],
        context: baseContext(),
        actions: baseActions(),
      }),
    )
    expect(screen.getByRole('button', { name: /Create note/ })).not.toBeNull()
  })

  it('renders multiple actions for multiple valid command ids', () => {
    render(
      createElement(SuggestedCommandActions, {
        commandIds: ['notes-create', 'knowledge-explore'],
        context: baseContext(),
        actions: baseActions(),
      }),
    )
    expect(screen.getByRole('button', { name: /Create note/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Explore knowledge graph/ })).not.toBeNull()
  })

  it('safely ignores an unknown/unregistered command id rather than rendering a broken action', () => {
    render(
      createElement(SuggestedCommandActions, {
        commandIds: ['notes-create', 'this-id-does-not-exist'],
        context: baseContext(),
        actions: baseActions(),
      }),
    )
    // The one real command still renders...
    expect(screen.getByRole('button', { name: /Create note/ })).not.toBeNull()
    // ...and nothing errors or renders a placeholder for the unknown id.
    expect(screen.queryByText('this-id-does-not-exist')).toBeNull()
  })

  it('omits a registered command whose isAvailable returns false in the current context', () => {
    render(
      createElement(SuggestedCommandActions, {
        commandIds: ['memory-manage'],
        context: baseContext({ workspaceId: null }),
        actions: baseActions(),
      }),
    )
    expect(screen.queryByRole('button', { name: /Manage memories/ })).toBeNull()
  })

  it('renders that same command once its isAvailable condition is met', () => {
    render(
      createElement(SuggestedCommandActions, {
        commandIds: ['memory-manage'],
        context: baseContext({ workspaceId: 'workspace-1' }),
        actions: baseActions(),
      }),
    )
    expect(screen.getByRole('button', { name: /Manage memories/ })).not.toBeNull()
  })

  it('clicking an action invokes the existing command execution mechanism (command.execute) with the current context and actions — no new dispatch path', () => {
    const context = baseContext()
    const actions = baseActions()
    render(createElement(SuggestedCommandActions, { commandIds: ['notes-create'], context, actions }))

    fireEvent.click(screen.getByRole('button', { name: /Create note/ }))

    expect(NOTES_CREATE_EXECUTE).toHaveBeenCalledTimes(1)
    expect(NOTES_CREATE_EXECUTE).toHaveBeenCalledWith(context, actions)
  })

  describe('integration: planner classification -> UI action -> existing command execution', () => {
    it('"reader-continue" (resolved the same way NovaCommandBar/deriveActionChips already do, for the "Where was I in Deep Work?" scenario) renders a contextual action and, on click, navigates via the existing reader command', () => {
      const actions = baseActions()
      const context = baseContext({
        inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: '2026-01-01T00:00:00Z' },
      })

      render(createElement(SuggestedCommandActions, { commandIds: ['reader-continue'], context, actions }))

      const button = screen.getByRole('button', { name: /Continue reading Deep Work/ })
      fireEvent.click(button)

      expect(actions.navigate).toHaveBeenCalledWith('/library/doc-1/read')
    })

    it('omits "reader-continue" (rather than a broken action) when the planner suggested it but nothing is actually in progress', () => {
      render(
        createElement(SuggestedCommandActions, {
          commandIds: ['reader-continue'],
          context: baseContext({ inProgressDocument: null }),
          actions: baseActions(),
        }),
      )
      expect(screen.queryByRole('button', { name: /Continue reading/ })).toBeNull()
    })

    it('a non-reader planner suggestion ("knowledge-explore") also resolves through the registry and executes on click', () => {
      const context = baseContext()
      const actions = baseActions()
      render(createElement(SuggestedCommandActions, { commandIds: ['knowledge-explore'], context, actions }))

      fireEvent.click(screen.getByRole('button', { name: /Explore knowledge graph/ }))

      expect(KNOWLEDGE_EXPLORE_EXECUTE).toHaveBeenCalledWith(context, actions)
    })
  })
})
