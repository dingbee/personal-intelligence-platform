import { useQuery } from '@tanstack/react-query'
import { getDocumentWithTags } from '@/modules/library/api/documents'

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: ['document-detail', documentId],
    queryFn: () => getDocumentWithTags(documentId),
  })
}
