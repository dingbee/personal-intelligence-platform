import { supabase } from '@/shared/lib/supabase'

/**
 * UX-13.11 Phase 3 — zero-result recovery: distinguishes "your library is
 * empty" from "we searched everything and found nothing for this query."
 * Only called when a search comes back empty (see SearchPage), not run on
 * every search. RLS already scopes every table to the authenticated user,
 * same as every other query in this module — no explicit user filter needed.
 */
export async function hasAnyIndexableContent(): Promise<boolean> {
  const [documents, notes, conversations] = await Promise.all([
    supabase.from('documents').select('id', { count: 'exact', head: true }),
    supabase.from('notes').select('id', { count: 'exact', head: true }),
    supabase.from('conversations').select('id', { count: 'exact', head: true }),
  ])
  return (documents.count ?? 0) > 0 || (notes.count ?? 0) > 0 || (conversations.count ?? 0) > 0
}
