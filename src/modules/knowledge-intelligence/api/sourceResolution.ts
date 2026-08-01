import { supabase } from '@/shared/lib/supabase'

/**
 * Platform Coherence Sprint v2 — the source-reference resolution pattern
 * ("given a list of {type, id} references, look up each one's display
 * title and drop the ones that don't resolve") was duplicated
 * near-verbatim across getKnowledgeNodeEvidence (Evidence view),
 * listCollectionItems (Collections), and useKnowledgeNodeDetails
 * (Explorer/Dashboard). Extracted here so all four surfaces resolve
 * sources identically — same skip-if-unresolved behavior everywhere —
 * without forcing them onto one fetch strategy: callers still choose how
 * to build their title lookup (a batch of `.in('id', ids)` queries here,
 * or already-cached client hooks in useKnowledgeNodeDetails), since that
 * choice is a legitimate difference in each surface's data-loading needs,
 * not the duplicated part.
 */

/** The `fetchTitles`-shaped batch query every source-resolving API function needs at least once: `SELECT id, title FROM <table> WHERE id IN (...)`, or `[]` when there's nothing to fetch. */
export async function fetchTitlesByIds(table: string, ids: string[] | undefined): Promise<{ id: string; title: string }[]> {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase.from(table).select('id, title').in('id', ids)
  if (error) throw error
  return data
}

/**
 * Resolves each `{type, id, ...}` item's `label` via the caller-supplied
 * lookup, dropping any item the lookup can't resolve (e.g. its source
 * document/note/conversation was since deleted — knowledge_node_sources
 * and the collection membership links in knowledge_links are never
 * cascade-removed, so a stale reference is expected, not an error).
 * `lookupLabel` is a plain function rather than a fixed Map so each call
 * site can key its lookup however it already does (some key by id alone,
 * useKnowledgeNodeDetails keys by `${type}:${id}`) — this only unifies the
 * resolve-and-filter step, not the lookup's own shape.
 */
export function resolveSourceItems<T extends { type: string; id: string }>(
  items: T[],
  lookupLabel: (type: string, id: string) => string | undefined,
): (T & { label: string })[] {
  const resolved: (T & { label: string })[] = []
  for (const item of items) {
    const label = lookupLabel(item.type, item.id)
    if (!label) continue
    resolved.push({ ...item, label })
  }
  return resolved
}
