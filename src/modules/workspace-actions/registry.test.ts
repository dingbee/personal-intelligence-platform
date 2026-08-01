import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('workspace action registry', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('matches the first registered action whose match() returns a payload', async () => {
    const { registerWorkspaceAction, matchWorkspaceAction } = await import('@/modules/workspace-actions/registry')
    const first = { id: 'first', match: () => undefined, run: vi.fn() }
    const second = { id: 'second', match: (text: string) => (text === 'hello' ? { greeting: text } : undefined), run: vi.fn() }
    registerWorkspaceAction(first)
    registerWorkspaceAction(second)

    const result = matchWorkspaceAction('hello')
    expect(result?.action.id).toBe('second')
    expect(result?.payload).toEqual({ greeting: 'hello' })
  })

  it('returns null when no action matches', async () => {
    const { registerWorkspaceAction, matchWorkspaceAction } = await import('@/modules/workspace-actions/registry')
    registerWorkspaceAction({ id: 'never', match: () => undefined, run: vi.fn() })
    expect(matchWorkspaceAction('anything')).toBeNull()
  })

  it('runWorkspaceAction runs the matched action and returns its outcome', async () => {
    const { registerWorkspaceAction, runWorkspaceAction } = await import('@/modules/workspace-actions/registry')
    registerWorkspaceAction({
      id: 'echo',
      match: (text: string) => (text === 'echo' ? {} : undefined),
      run: async () => ({ responseText: 'echoed' }),
    })

    const outcome = await runWorkspaceAction('echo', { userId: 'u', workspaceId: null, conversationId: 'c', chain: [] })
    expect(outcome).toEqual({ responseText: 'echoed' })
  })

  it('runWorkspaceAction returns null (not a rejected promise) when nothing matches', async () => {
    const { runWorkspaceAction } = await import('@/modules/workspace-actions/registry')
    const outcome = await runWorkspaceAction('unmatched text', { userId: 'u', workspaceId: null, conversationId: 'c', chain: [] })
    expect(outcome).toBeNull()
  })

  it('a payload of {} (falsy-looking but defined) still counts as a match, not a miss', async () => {
    const { registerWorkspaceAction, matchWorkspaceAction } = await import('@/modules/workspace-actions/registry')
    registerWorkspaceAction({ id: 'zero-arg', match: () => ({}), run: vi.fn() })
    const result = matchWorkspaceAction('anything')
    expect(result?.action.id).toBe('zero-arg')
  })
})
