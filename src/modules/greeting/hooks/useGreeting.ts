import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { getGreetingData } from '@/modules/greeting/api/greetingData'
import { computeGreeting, deriveNameFromEmail, type Greeting } from '@/modules/greeting/greetingEngine'

const FALLBACK: Greeting = { headline: 'Welcome.', subtext: "Let's continue building your knowledge." }

export function useGreeting(): Greeting {
  const { user } = useAuth()
  const { data: profile } = useProfile()

  const { data } = useQuery({
    queryKey: ['greeting-data'],
    queryFn: getGreetingData,
    enabled: Boolean(user),
    // The facts behind a greeting (yesterday's connections, today's graph
    // growth) don't need to be second-fresh — a few minutes stale is fine
    // for chrome that's visible on every page.
    staleTime: 5 * 60 * 1000,
  })

  if (!user || !data) return FALLBACK

  const name = profile?.display_name?.trim() || deriveNameFromEmail(user.email ?? '')

  return computeGreeting({
    now: new Date(),
    name,
    newKnowledgeConnectionsYesterday: data.newKnowledgeConnectionsYesterday,
    knowledgeGraphGrowthToday: data.knowledgeGraphGrowthToday,
    inProgressDocumentTitle: data.inProgressDocumentTitle,
    daysSinceLastActivity: data.daysSinceLastActivity,
  })
}
