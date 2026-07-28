import { appConfig } from '@/app/appConfig'

/**
 * Deterministic greeting rules (Phase UX-3). Priority, highest first:
 * 1. Long inactivity (>= 3 days) — surfacing this always beats a fact
 *    about yesterday/today, since there isn't one.
 * 2. A time-of-day-specific fact, when the data backs it up.
 * 3. Weekend fallback.
 * 4. Generic fallback.
 * A future phase can swap this out for an AI-generated greeting without
 * changing GreetingContext's shape — same input, richer output.
 */
export interface GreetingContext {
  now: Date
  name: string
  newKnowledgeConnectionsYesterday: number
  knowledgeGraphGrowthToday: number
  inProgressDocumentTitle: string | null
  daysSinceLastActivity: number | null
}

export interface Greeting {
  headline: string
  subtext: string
}

type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening'

function timeOfDay(hour: number): TimeOfDay {
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export function computeGreeting(ctx: GreetingContext): Greeting {
  const hour = ctx.now.getHours()
  const day = ctx.now.getDay()
  const isWeekend = day === 0 || day === 6
  const period = timeOfDay(hour)
  const headline = `Good ${period}, ${ctx.name}.`

  if (ctx.daysSinceLastActivity !== null && ctx.daysSinceLastActivity >= 3) {
    return {
      headline: `It's been ${ctx.daysSinceLastActivity} days.`,
      subtext: 'Shall we continue where you left off?',
    }
  }

  if (period === 'Morning' && ctx.newKnowledgeConnectionsYesterday > 0) {
    return {
      headline,
      subtext: `You discovered ${ctx.newKnowledgeConnectionsYesterday} new knowledge connection${
        ctx.newKnowledgeConnectionsYesterday === 1 ? '' : 's'
      } yesterday.`,
    }
  }

  if (period === 'Afternoon' && ctx.inProgressDocumentTitle) {
    return { headline: 'Welcome back.', subtext: `Continue reading ${ctx.inProgressDocumentTitle}?` }
  }

  if (period === 'Evening' && ctx.knowledgeGraphGrowthToday > 0) {
    return {
      headline,
      subtext: `Your knowledge graph grew by ${ctx.knowledgeGraphGrowthToday} relationship${
        ctx.knowledgeGraphGrowthToday === 1 ? '' : 's'
      } today.`,
    }
  }

  if (isWeekend) {
    return { headline, subtext: 'Ready for another learning session?' }
  }

  return { headline, subtext: appConfig.tagline }
}

/** Best-effort display name from an email's local part when no display name is set — "ding.smith@x.com" → "Ding". */
export function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  const firstToken = local.split(/[._+-]/)[0] || local
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1)
}
