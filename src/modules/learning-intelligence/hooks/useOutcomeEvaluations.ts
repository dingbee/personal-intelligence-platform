import { useQuery } from '@tanstack/react-query'
import { listOutcomeEvaluations } from '@/modules/learning-intelligence/api/learningQueries'

export function useOutcomeEvaluations(recordId: string | null) {
  return useQuery({
    queryKey: ['outcome-evaluations', recordId],
    queryFn: () => listOutcomeEvaluations(recordId!),
    enabled: Boolean(recordId),
  })
}
