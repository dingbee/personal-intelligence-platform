import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { listLinksFor, createLink, deleteLink } from '@/modules/knowledgeLinks/api/knowledgeLinks'
import { linkResolverRegistry } from '@/modules/knowledgeLinks/registry'
import type { LinkableItem, LinkableType } from '@/modules/knowledgeLinks/types'

export interface ResolvedLink {
  linkId: string
  item: LinkableItem
}

/** Backlinks for one node (e.g. a note), resolved to displayable items, plus add/remove mutations. */
export function useKnowledgeLinks(type: LinkableType, id: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['knowledge-links', type, id]

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ResolvedLink[]> => {
      const edges = await listLinksFor(type, id)
      if (edges.length === 0) return []

      const idsByType = new Map<LinkableType, string[]>()
      for (const edge of edges) {
        idsByType.set(edge.otherType, [...(idsByType.get(edge.otherType) ?? []), edge.otherId])
      }

      const resolvedItems = await Promise.all(
        Array.from(idsByType.entries()).map(([otherType, ids]) => {
          const resolver = linkResolverRegistry.get(otherType)
          return resolver ? resolver.resolve(ids) : Promise.resolve([])
        }),
      )
      const itemByKey = new Map(resolvedItems.flat().map((item) => [`${item.type}:${item.id}`, item]))

      return edges
        .map((edge) => ({ linkId: edge.linkId, item: itemByKey.get(`${edge.otherType}:${edge.otherId}`) }))
        .filter((entry): entry is ResolvedLink => Boolean(entry.item))
    },
    enabled: Boolean(user),
  })

  const addLink = useMutation({
    mutationFn: (target: { type: LinkableType; id: string }) =>
      createLink({
        userId: user!.id,
        workspaceId: currentWorkspaceId,
        sourceType: type,
        sourceId: id,
        targetType: target.type,
        targetId: target.id,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeLink = useMutation({
    mutationFn: (linkId: string) => deleteLink(linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { links: query.data ?? [], isLoading: query.isLoading, addLink, removeLink }
}
