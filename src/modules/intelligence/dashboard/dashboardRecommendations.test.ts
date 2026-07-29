import { describe, expect, it } from 'vitest'
import { generateDashboardRecommendations } from '@/modules/intelligence/dashboard/dashboardRecommendations'
import type { CommandContext } from '@/modules/commands/types'

function baseContext(overrides: Partial<CommandContext> = {}): CommandContext {
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

function baseInput(overrides: Partial<Parameters<typeof generateDashboardRecommendations>[0]> = {}) {
  return {
    commandContext: baseContext(),
    hasGraphContext: false,
    hasMemoryToReview: false,
    informationOrganizationScore: 100,
    ...overrides,
  }
}

describe('generateDashboardRecommendations', () => {
  it('always includes an explore recommendation to create a note', () => {
    const recommendations = generateDashboardRecommendations(baseInput())
    expect(recommendations.some((r) => r.category === 'explore' && r.command.id === 'notes-create')).toBe(true)
  })

  it('suggests continuing reading when a document is in progress', () => {
    const recommendations = generateDashboardRecommendations(
      baseInput({ commandContext: baseContext({ inProgressDocument: { id: 'doc-1', title: 'Deep Work' } }) }),
    )
    expect(recommendations.some((r) => r.category === 'continue' && r.command.title.includes('Deep Work'))).toBe(true)
  })

  it('omits the continue recommendation when nothing is in progress', () => {
    const recommendations = generateDashboardRecommendations(baseInput())
    expect(recommendations.some((r) => r.category === 'continue')).toBe(false)
  })

  it('suggests exploring the knowledge graph when there is graph context', () => {
    const recommendations = generateDashboardRecommendations(baseInput({ hasGraphContext: true }))
    expect(recommendations.some((r) => r.category === 'explore' && r.command.id === 'knowledge-explore')).toBe(true)
  })

  it('omits the knowledge graph recommendation when there is no graph context', () => {
    const recommendations = generateDashboardRecommendations(baseInput({ hasGraphContext: false }))
    expect(recommendations.some((r) => r.command.id === 'knowledge-explore')).toBe(false)
  })

  it('recommends reviewing memory suggestions when there is something to review', () => {
    const recommendations = generateDashboardRecommendations(baseInput({ hasMemoryToReview: true }))
    expect(recommendations.some((r) => r.category === 'review' && r.command.id === 'memory-review-suggestions')).toBe(true)
  })

  it('recommends managing memories generically when there is nothing specific to review', () => {
    const recommendations = generateDashboardRecommendations(baseInput({ hasMemoryToReview: false }))
    expect(recommendations.some((r) => r.category === 'review' && r.command.id === 'memory-manage')).toBe(true)
  })

  it('recommends organizing the library when the organization score is low', () => {
    const recommendations = generateDashboardRecommendations(baseInput({ informationOrganizationScore: 40 }))
    expect(recommendations.some((r) => r.category === 'organize')).toBe(true)
  })

  it('omits the organize recommendation when the organization score is already high', () => {
    const recommendations = generateDashboardRecommendations(baseInput({ informationOrganizationScore: 95 }))
    expect(recommendations.some((r) => r.category === 'organize')).toBe(false)
  })

  it('never invents a command outside the existing registry (every recommendation has a real command id)', () => {
    const recommendations = generateDashboardRecommendations(
      baseInput({ hasGraphContext: true, hasMemoryToReview: true, informationOrganizationScore: 10 }),
    )
    expect(recommendations.every((r) => typeof r.command.id === 'string' && r.command.id.length > 0)).toBe(true)
  })

  it('gives every recommendation a human-readable reason', () => {
    const recommendations = generateDashboardRecommendations(
      baseInput({ hasGraphContext: true, hasMemoryToReview: true, informationOrganizationScore: 10 }),
    )
    expect(recommendations.every((r) => typeof r.reason === 'string' && r.reason.length > 0)).toBe(true)
  })

  it('produces at least one recommendation in every category when all conditions are met', () => {
    const recommendations = generateDashboardRecommendations({
      commandContext: baseContext({ inProgressDocument: { id: 'doc-1', title: 'Deep Work' } }),
      hasGraphContext: true,
      hasMemoryToReview: true,
      informationOrganizationScore: 10,
    })
    expect(new Set(recommendations.map((r) => r.category))).toEqual(new Set(['explore', 'review', 'continue', 'organize']))
  })
})
