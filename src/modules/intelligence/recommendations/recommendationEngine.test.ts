import { beforeAll, describe, expect, it } from 'vitest'
import { commandRegistry } from '@/modules/commands/registry'
import { generateRecommendations } from '@/modules/intelligence/recommendations/recommendationEngine'
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

// Ported unchanged (behavior-preserving) from orchestrator/suggestionEngine.test.ts.
describe('generateRecommendations — chat scope', () => {
  it('always includes the curated action chips', () => {
    const recommendations = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext(),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: null,
    })
    expect(recommendations.map((r) => r.command.id)).toEqual(expect.arrayContaining(['notes-create', 'search-open']))
  })

  it('offers "Explore knowledge graph" only when the graph contributed this turn', () => {
    const without = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext(),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: null,
    })
    expect(without.some((r) => r.command.id === 'knowledge-explore')).toBe(false)

    const withGraph = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext(),
      hasGraphContext: true,
      relatedConversation: null,
      mostActiveWorkspace: null,
    })
    expect(withGraph.some((r) => r.command.id === 'knowledge-explore')).toBe(true)
  })

  it('offers a resume-conversation suggestion only when one is provided', () => {
    const recommendations = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext(),
      hasGraphContext: false,
      relatedConversation: { id: 'conv-1', title: 'Marketing plan' },
      mostActiveWorkspace: null,
    })
    const found = recommendations.find((r) => r.command.id === 'conversation-resume-conv-1')
    expect(found).toBeDefined()
    expect(found?.reason).toContain('Marketing plan')
  })

  it('offers a workspace-switch suggestion only when the most active workspace differs from the current one', () => {
    const same = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext({ workspaceId: 'w1' }),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: { id: 'w1', name: 'Research' },
    })
    expect(same.some((r) => r.command.id.startsWith('workspace-switch'))).toBe(false)

    const different = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext({ workspaceId: 'w1' }),
      hasGraphContext: false,
      relatedConversation: null,
      mostActiveWorkspace: { id: 'w2', name: 'Archive' },
    })
    expect(different.some((r) => r.command.id === 'workspace-switch-w2')).toBe(true)
  })
})

// Ported unchanged (behavior-preserving) from dashboard/dashboardRecommendations.test.ts.
function dashboardContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: null,
    workspaceName: null,
    pathname: '/dashboard',
    documentId: null,
    inProgressDocument: null,
    ...overrides,
  }
}

function baseDashboardInput(overrides: Partial<Parameters<typeof generateRecommendations>[0]> = {}) {
  return {
    scope: 'dashboard' as const,
    commandContext: dashboardContext(),
    hasGraphContext: false,
    hasMemoryToReview: false,
    informationOrganizationScore: 100,
    ...overrides,
  }
}

describe('generateRecommendations — dashboard scope', () => {
  it('always includes an explore recommendation to create a note', () => {
    const recommendations = generateRecommendations(baseDashboardInput())
    expect(recommendations.some((r) => r.category === 'explore' && r.command.id === 'notes-create')).toBe(true)
  })

  it('suggests continuing reading when a document is in progress', () => {
    const recommendations = generateRecommendations(
      baseDashboardInput({ commandContext: dashboardContext({ inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: '2024-01-01T00:00:00Z' } }) }),
    )
    expect(recommendations.some((r) => r.category === 'continue' && r.command.title.includes('Deep Work'))).toBe(true)
  })

  it('omits the continue recommendation when nothing is in progress', () => {
    const recommendations = generateRecommendations(baseDashboardInput())
    expect(recommendations.some((r) => r.category === 'continue')).toBe(false)
  })

  it('suggests exploring the knowledge graph when there is graph context', () => {
    const recommendations = generateRecommendations(baseDashboardInput({ hasGraphContext: true }))
    expect(recommendations.some((r) => r.category === 'explore' && r.command.id === 'knowledge-explore')).toBe(true)
  })

  it('omits the knowledge graph recommendation when there is no graph context', () => {
    const recommendations = generateRecommendations(baseDashboardInput({ hasGraphContext: false }))
    expect(recommendations.some((r) => r.command.id === 'knowledge-explore')).toBe(false)
  })

  it('recommends reviewing memory suggestions when there is something to review', () => {
    const recommendations = generateRecommendations(baseDashboardInput({ hasMemoryToReview: true }))
    expect(recommendations.some((r) => r.category === 'review' && r.command.id === 'memory-review-suggestions')).toBe(true)
  })

  it('recommends managing memories generically when there is nothing specific to review', () => {
    const recommendations = generateRecommendations(baseDashboardInput({ hasMemoryToReview: false }))
    expect(recommendations.some((r) => r.category === 'review' && r.command.id === 'memory-manage')).toBe(true)
  })

  it('recommends organizing the library when the organization score is low', () => {
    const recommendations = generateRecommendations(baseDashboardInput({ informationOrganizationScore: 40 }))
    expect(recommendations.some((r) => r.category === 'organize')).toBe(true)
  })

  it('omits the organize recommendation when the organization score is already high', () => {
    const recommendations = generateRecommendations(baseDashboardInput({ informationOrganizationScore: 95 }))
    expect(recommendations.some((r) => r.category === 'organize')).toBe(false)
  })

  it('never invents a command outside the existing registry (every recommendation has a real command id)', () => {
    const recommendations = generateRecommendations(
      baseDashboardInput({ hasGraphContext: true, hasMemoryToReview: true, informationOrganizationScore: 10 }),
    )
    expect(recommendations.every((r) => typeof r.command.id === 'string' && r.command.id.length > 0)).toBe(true)
  })

  it('gives every recommendation a human-readable reason', () => {
    const recommendations = generateRecommendations(
      baseDashboardInput({ hasGraphContext: true, hasMemoryToReview: true, informationOrganizationScore: 10 }),
    )
    expect(recommendations.every((r) => typeof r.reason === 'string' && r.reason.length > 0)).toBe(true)
  })

  it('produces at least one recommendation in every category when all conditions are met', () => {
    const recommendations = generateRecommendations({
      scope: 'dashboard',
      commandContext: dashboardContext({ inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: '2024-01-01T00:00:00Z' } }),
      hasGraphContext: true,
      hasMemoryToReview: true,
      informationOrganizationScore: 10,
    })
    expect(new Set(recommendations.map((r) => r.category))).toEqual(new Set(['explore', 'review', 'continue', 'organize']))
  })
})

// New — the one characteristic this consolidation is actually for: both
// scopes are reachable from the same exported function and type.
describe('generateRecommendations — scope isolation', () => {
  it('never applies dashboard-only signals to the chat scope', () => {
    const recommendations = generateRecommendations({
      scope: 'chat',
      commandContext: baseContext(),
      hasGraphContext: false,
      // dashboard-only signals — must be ignored under scope: 'chat'
      hasMemoryToReview: true,
      informationOrganizationScore: 0,
    })
    expect(recommendations.some((r) => r.command.id === 'memory-review-suggestions')).toBe(false)
    expect(recommendations.some((r) => r.category === 'organize' && r.command.id === 'nav-library')).toBe(false)
  })

  it('never applies chat-only signals to the dashboard scope', () => {
    const recommendations = generateRecommendations({
      scope: 'dashboard',
      commandContext: dashboardContext(),
      hasGraphContext: false,
      // chat-only signals — must be ignored under scope: 'dashboard'
      relatedConversation: { id: 'conv-1', title: 'Marketing plan' },
      mostActiveWorkspace: { id: 'w2', name: 'Archive' },
    })
    expect(recommendations.some((r) => r.command.id === 'conversation-resume-conv-1')).toBe(false)
    expect(recommendations.some((r) => r.command.id === 'workspace-switch-w2')).toBe(false)
  })
})
