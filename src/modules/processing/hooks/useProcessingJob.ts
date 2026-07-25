import { useQuery } from '@tanstack/react-query'
import { getLatestProcessingJob, TERMINAL_STATUSES } from '@/modules/processing/api/jobs'

export function useProcessingJob(documentId: string) {
  return useQuery({
    queryKey: ['processing-job', documentId],
    queryFn: () => getLatestProcessingJob(documentId),
    refetchInterval: (query) => {
      const job = query.state.data
      if (!job || TERMINAL_STATUSES.includes(job.status)) return false
      return 2000
    },
  })
}
