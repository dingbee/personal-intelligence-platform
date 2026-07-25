import { useQuery } from '@tanstack/react-query'
import { listDocuments, type DocumentFilters } from '@/modules/library/api/documents'
import { useAuth } from '@/modules/auth/useAuth'

export function useDocuments(filters: DocumentFilters) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => listDocuments(filters),
    enabled: Boolean(user),
  })
}
