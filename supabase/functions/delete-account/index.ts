// Supabase Edge Function (Deno). Sprint 10/10 (Final Platform Validation)
// — self-service account deletion. The one place in this codebase that
// calls `auth.admin.deleteUser`, which requires the service-role key and
// therefore can only run server-side, following the exact same trust-
// boundary pattern send-workspace-invitation established:
//
//   1. The caller's own JWT (forwarded automatically by
//      `supabase.functions.invoke` from the browser) authenticates the
//      request via a plain anon-key client. No JWT, no auth.getUser()
//      match -> 401.
//   2. Self-service only, deliberately: this function always deletes the
//      CALLING user's own account. It never accepts a target user id
//      from the request body — there is no "delete another user" path
//      here at all, so there is no authorization check to get wrong for
//      that case; it simply doesn't exist.
//   3. Founder/admin protection: `is_platform_admin()` (0035_platform_
//      admin_foundation.sql) is re-checked here, as the caller, before
//      anything is deleted. An admin account can never self-delete
//      through this path — role-based, not a hardcoded email/id check,
//      so it protects whichever account(s) are ever granted admin, not
//      just today's bootstrap founder.
//   4. Only once both checks pass does a service-role client get created,
//      used for exactly two things: removing the caller's own Storage
//      objects (RLS on `storage.objects` already scopes these to their
//      owner, but bulk-listing/removing an entire prefix is naturally a
//      server-side bulk operation, same class of exception `send-
//      workspace-invitation` already documents) and the
//      `auth.admin.deleteUser` call itself, which has no client-callable
//      equivalent at all.
//
// What actually gets deleted: every table in this schema with a
// `user_id`/`owner_id` foreign key to `auth.users(id)` uses `on delete
// cascade` (confirmed by inspecting every migration from 0001 through
// 0037 — see docs/account-deletion-data-map.md for the full table-by-
// table record) — so deleting the `auth.users` row cascades through
// documents, chunks, embeddings, notes, conversations, messages, memory,
// knowledge nodes/links, assets, collections, tags, workspaces (if
// owned), workspace membership, reading progress, highlights,
// flashcards, dismissed suggestions, provider overrides, ai_requests,
// and processing jobs automatically, with zero additional application
// code. `workspace_id` foreign keys on every OTHER user's content use
// `on delete set null`, not cascade — so if the deleted user owned a
// shared workspace, other members keep every one of their own documents/
// notes/etc., just disassociated from that (now-gone) workspace. Nothing
// belonging to another user is ever touched.
//
// The two things the database's own cascade design does NOT reach —
// Storage objects (files aren't rows) and the `auth.users` row itself
// (needs the admin API, not a table delete) — are exactly what this
// function does explicitly.
//
// Deploy: supabase functions deploy delete-account

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const STORAGE_LIST_PAGE_SIZE = 100
const USER_STORAGE_BUCKETS = ['documents', 'assets']

interface StorageEntry {
  name: string
  id: string | null
}

/** Mirrors src/shared/lib/collectStorageFilePaths.ts's algorithm exactly — see that file's own tests for the recursion/pagination behavior pinned here. Edge functions in this codebase deliberately duplicate a small amount of logic rather than cross-runtime-import from src/ (see send-workspace-invitation's own header comment for the established precedent). */
async function collectStorageFilePaths(
  list: (path: string, offset: number) => Promise<StorageEntry[]>,
  prefix: string,
): Promise<string[]> {
  const filePaths: string[] = []
  let offset = 0
  for (;;) {
    const entries = await list(prefix, offset)
    for (const entry of entries) {
      const fullPath = `${prefix}/${entry.name}`
      if (entry.id === null) {
        filePaths.push(...(await collectStorageFilePaths(list, fullPath)))
      } else {
        filePaths.push(fullPath)
      }
    }
    if (entries.length < STORAGE_LIST_PAGE_SIZE) break
    offset += STORAGE_LIST_PAGE_SIZE
  }
  return filePaths
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse('Supabase connection secrets are not configured', 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Unauthorized', 401)

  // Step 1: authenticate as the caller, never the service role.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return errorResponse('Unauthorized', 401)

  // Step 3: founder/admin protection — role-based, re-checked server-side.
  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_platform_admin')
  if (adminCheckError) return errorResponse(adminCheckError.message, 500)
  if (isAdmin) {
    return errorResponse(
      'Platform admin accounts cannot be deleted through self-service account deletion. Contact another administrator to revoke admin status first.',
      403,
    )
  }

  // Step 4: escalate to service role, strictly for Storage cleanup and the admin-only deleteUser call.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  for (const bucket of USER_STORAGE_BUCKETS) {
    const list = (path: string, offset: number) =>
      serviceClient.storage
        .from(bucket)
        .list(path, { limit: STORAGE_LIST_PAGE_SIZE, offset })
        .then(({ data, error }) => {
          if (error) throw error
          return (data ?? []) as StorageEntry[]
        })

    const paths = await collectStorageFilePaths(list, user.id).catch((err: unknown) => {
      // A listing failure here must not silently skip deletion of the
      // account itself — surface it rather than proceeding with a
      // partial cleanup the caller can't see.
      throw new Error(`Failed to list ${bucket} storage objects for deletion: ${err instanceof Error ? err.message : String(err)}`)
    })

    if (paths.length > 0) {
      const { error: removeError } = await serviceClient.storage.from(bucket).remove(paths)
      if (removeError) return errorResponse(`Failed to remove ${bucket} storage objects: ${removeError.message}`, 500)
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)
  if (deleteError) return errorResponse(`Failed to delete account: ${deleteError.message}`, 500)

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
})
