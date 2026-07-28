import { describe, expect, it } from 'vitest'
import { computeGreeting, deriveNameFromEmail, type GreetingContext } from '@/modules/greeting/greetingEngine'

function baseContext(overrides: Partial<GreetingContext> = {}): GreetingContext {
  return {
    now: new Date('2026-07-28T09:00:00'), // Tuesday morning
    name: 'Ding',
    newKnowledgeConnectionsYesterday: 0,
    knowledgeGraphGrowthToday: 0,
    inProgressDocumentTitle: null,
    daysSinceLastActivity: 0,
    ...overrides,
  }
}

describe('computeGreeting', () => {
  it('leads with new connections in the morning when there are any', () => {
    const greeting = computeGreeting(baseContext({ newKnowledgeConnectionsYesterday: 18 }))
    expect(greeting.headline).toBe('Good Morning, Ding.')
    expect(greeting.subtext).toBe('You discovered 18 new knowledge connections yesterday.')
  })

  it('singularizes "connection" for exactly one', () => {
    const greeting = computeGreeting(baseContext({ newKnowledgeConnectionsYesterday: 1 }))
    expect(greeting.subtext).toBe('You discovered 1 new knowledge connection yesterday.')
  })

  it('offers to continue reading in the afternoon when a book is in progress', () => {
    const greeting = computeGreeting(
      baseContext({ now: new Date('2026-07-28T14:00:00'), inProgressDocumentTitle: 'Atomic Habits' }),
    )
    expect(greeting).toEqual({ headline: 'Welcome back.', subtext: 'Continue reading Atomic Habits?' })
  })

  it('reports graph growth in the evening', () => {
    const greeting = computeGreeting(baseContext({ now: new Date('2026-07-28T19:00:00'), knowledgeGraphGrowthToday: 34 }))
    expect(greeting.headline).toBe('Good Evening, Ding.')
    expect(greeting.subtext).toBe('Your knowledge graph grew by 34 relationships today.')
  })

  it('falls back to a weekend prompt with no facts on a Saturday', () => {
    const greeting = computeGreeting(baseContext({ now: new Date('2026-08-01T10:00:00') })) // Saturday
    expect(greeting.subtext).toBe('Ready for another learning session?')
  })

  it('falls back to the generic line on a weekday with no facts', () => {
    const greeting = computeGreeting(baseContext())
    expect(greeting).toEqual({ headline: 'Good Morning, Ding.', subtext: "Let's continue building your knowledge." })
  })

  it('prioritizes long inactivity over every other signal', () => {
    const greeting = computeGreeting(
      baseContext({ daysSinceLastActivity: 5, newKnowledgeConnectionsYesterday: 18, knowledgeGraphGrowthToday: 34 }),
    )
    expect(greeting).toEqual({ headline: "It's been 5 days.", subtext: 'Shall we continue where you left off?' })
  })

  it('does not treat fewer than 3 days as long inactivity', () => {
    const greeting = computeGreeting(baseContext({ daysSinceLastActivity: 2 }))
    expect(greeting.headline).not.toContain("It's been")
  })
})

describe('deriveNameFromEmail', () => {
  it('capitalizes the local part when there is no separator', () => {
    expect(deriveNameFromEmail('ding@example.com')).toBe('Ding')
  })

  it('takes the first token before a dot/underscore/hyphen/plus', () => {
    expect(deriveNameFromEmail('ding.smith@example.com')).toBe('Ding')
    expect(deriveNameFromEmail('ding_smith@example.com')).toBe('Ding')
    expect(deriveNameFromEmail('ding-smith@example.com')).toBe('Ding')
    expect(deriveNameFromEmail('ding+tag@example.com')).toBe('Ding')
  })
})
