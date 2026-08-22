import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listLearningSignals } from '@/modules/learning-intelligence/api/learningQueries'
import type { LearningSignalStatus } from '@/modules/learning-intelligence/learning'

export function useLearningSignals(status?: LearningSignalStatus) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['learning-signals', status ?? 'all'],
    queryFn: () => listLearningSignals(status ? { status } : {}),
    enabled: Boolean(user),
  })
}
