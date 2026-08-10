import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listMessages, listMessagesPage, listMessagesSince } from '@/modules/ai/chat/api/messages'
import type { Message } from '@/shared/types/database'

interface WindowState {
  /** False until the first page has actually landed. */
  bootstrapped: boolean
  /**
   * The fixed lower boundary of the "current window" query, established
   * once from the first page and never moved by loadOlder — only
   * loadOlder's own, separate cursor (oldestLoadedCreatedAt below) moves
   * backward. Null after bootstrap means the conversation has no older
   * history at all (fewer than MESSAGES_PAGE_SIZE messages total), so the
   * window query can safely just be "everything."
   */
  windowCursor: string | null
}

/**
 * ARRIYIA Product Completion Phase 2 — opening a conversation now loads a
 * bounded initial page (MESSAGES_PAGE_SIZE) instead of its entire history,
 * with an explicit loadOlder() for the rest.
 *
 * Why the "window" query uses an open lower bound (listMessagesSince, `>=
 * windowCursor`) rather than a fixed-size "latest N" re-fetched on every
 * invalidate: a fixed-size window re-fetched after a new message arrives
 * would silently drop whatever had just aged out of "the latest N" —
 * a message the user was already looking at would vanish. Anchoring the
 * window to a fixed cursor and only ever growing it forward means an
 * invalidate/refetch (every send, per useSendMessage) can never make an
 * already-shown message disappear, and always safely picks up new ones.
 *
 * loadOlder() is a second, independent cursor (oldestLoadedCreatedAt) that
 * only ever moves backward, merging pages into `olderMessages` — it never
 * touches windowCursor, so it can't be affected by (or affect) ordinary
 * sends/streaming/retries the way a shared, refetch-recomputed cursor
 * would be.
 */
export function useMessages(conversationId: string | null) {
  const [windowState, setWindowState] = useState<WindowState>({ bootstrapped: false, windowCursor: null })
  const [oldestLoadedCreatedAt, setOldestLoadedCreatedAt] = useState<string | null>(null)
  const [hasOlder, setHasOlder] = useState(false)
  const [olderMessages, setOlderMessages] = useState<Message[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadOlderError, setLoadOlderError] = useState<unknown>(null)

  // Resets all pagination state the moment the conversation being viewed
  // changes — this hook is one long-lived instance across conversation
  // switches (ChatPage/ReaderChatPanel don't remount it), so nothing else
  // would otherwise clear a previous conversation's cursors/older pages.
  // Sanctioned React pattern for "derive state from a changed prop" (see
  // react.dev "Adjusting state when a prop changes") — safe to call
  // setState mid-render here since it bails out unless conversationId
  // actually changed.
  const [conversationForState, setConversationForState] = useState(conversationId)
  if (conversationId !== conversationForState) {
    setConversationForState(conversationId)
    setWindowState({ bootstrapped: false, windowCursor: null })
    setOldestLoadedCreatedAt(null)
    setHasOlder(false)
    setOlderMessages([])
    setLoadOlderError(null)
  }

  const windowQuery = useQuery({
    queryKey: ['messages', conversationId, 'window'],
    queryFn: async () => {
      if (!windowState.bootstrapped) {
        const page = await listMessagesPage(conversationId!)
        const cursor = page.hasMore ? (page.messages[0]?.created_at ?? null) : null
        setWindowState({ bootstrapped: true, windowCursor: cursor })
        setOldestLoadedCreatedAt(cursor)
        setHasOlder(page.hasMore)
        return page.messages
      }
      if (windowState.windowCursor === null) return listMessages(conversationId!)
      return listMessagesSince(conversationId!, windowState.windowCursor)
    },
    enabled: Boolean(conversationId),
  })

  async function loadOlder() {
    if (!conversationId || !hasOlder || loadingOlder || oldestLoadedCreatedAt === null) return
    setLoadingOlder(true)
    setLoadOlderError(null)
    try {
      const page = await listMessagesPage(conversationId, oldestLoadedCreatedAt)
      setOlderMessages((prev) => [...page.messages, ...prev])
      setOldestLoadedCreatedAt(page.messages[0]?.created_at ?? oldestLoadedCreatedAt)
      setHasOlder(page.hasMore)
    } catch (err) {
      setLoadOlderError(err)
    } finally {
      setLoadingOlder(false)
    }
  }

  const data = useMemo(() => {
    const windowMessages = windowQuery.data ?? []
    // Defensive only — the two cursors are constructed so these two sets
    // should never actually overlap, but a duplicate id rendered twice
    // (React key collision) is exactly the failure mode worth guarding
    // against explicitly rather than trusting that invariant silently.
    const olderIds = new Set(olderMessages.map((m) => m.id))
    return [...olderMessages, ...windowMessages.filter((m) => !olderIds.has(m.id))]
  }, [olderMessages, windowQuery.data])

  return {
    ...windowQuery,
    data,
    hasOlder,
    loadOlder,
    loadingOlder,
    loadOlderError,
  }
}
