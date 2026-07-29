import { beforeAll, describe, expect, it } from 'vitest'
import { commandRegistry } from '@/modules/commands/registry'
import { deriveActionChips } from '@/modules/intelligence/actions/deriveActionChips'
import type { Command, CommandContext } from '@/modules/commands/types'

function baseContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: null,
    workspaceName: null,
    pathname: '/chat',
    documentId: null,
    inProgressDocument: null,
    ...overrides,
  }
}

function testCommand(id: string): Command {
  return { id, title: id, icon: '•', category: 'navigation', execute: () => {} }
}

const CURATED_IDS = ['notes-create', 'search-open', 'workspace-manage', 'memory-manage']

// The real registry is only populated by registerBuiltInCommands.ts's
// side-effect import (app/App.tsx) — this test registers its own
// matching-id + one extra command instead, same pattern
// AIService.test.ts/buildSystemPrompt.test.ts use for promptRegistry.
// Relies on Vitest's per-test-file module isolation for a fresh registry.
beforeAll(() => {
  for (const id of CURATED_IDS) commandRegistry.register(testCommand(id))
  commandRegistry.register(testCommand('notes-list'))
})

describe('deriveActionChips', () => {
  it('includes every curated command', () => {
    const ids = deriveActionChips(baseContext()).map((command) => command.id)
    expect(ids).toEqual(expect.arrayContaining(CURATED_IDS))
  })

  it('never includes a registered command outside the curated list', () => {
    const ids = deriveActionChips(baseContext()).map((command) => command.id)
    expect(ids).not.toContain('notes-list')
  })

  it('omits "Continue reading" when nothing is in progress', () => {
    const ids = deriveActionChips(baseContext({ inProgressDocument: null })).map((command) => command.id)
    expect(ids).not.toContain('reader-continue')
  })

  it('includes "Continue reading" (first) when something is in progress', () => {
    const chips = deriveActionChips(baseContext({ inProgressDocument: { id: 'doc-1', title: 'Deep Work' } }))
    expect(chips[0]?.id).toBe('reader-continue')
  })
})
