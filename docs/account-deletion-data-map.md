# Account Deletion — User Data Lifecycle Map

Produced by Sprint 10/10 (Final Platform Validation), Phase 7. Sprint 9.5/10 identified "no full account deletion" as the platform's one P1 pre-GA release-quality item. This document maps every place a user's data lives, then records the deletion design this sprint implemented against that map — `supabase/functions/delete-account/index.ts`, `src/modules/settings/api/accountDeletion.ts`, `src/shared/lib/collectStorageFilePaths.ts`, and the `DeleteAccountCard` Settings UI entry point.

## Method

Every migration file (`supabase/migrations/0001` through `0040`) was inspected directly for `references auth.users` foreign keys and their `on delete` behavior — not assumed from table names. The full result is below.

## Tables with a direct foreign key to `auth.users(id)`

Every one of these uses **`on delete cascade`** — confirmed by grep across all 37 relevant migration files, consistently, from the very first schema (`0001_init.sql`) through the most recent user-owned table added (`0037_dismissed_suggestions.sql`). Deleting the `auth.users` row deletes every row below automatically, with zero additional application code required.

| Table | Owner column | Cascades to (via further FKs) |
|---|---|---|
| `profiles` | `id` (own primary key, not a separate `user_id`) | — |
| `documents`, `collections`, `tags` | `user_id` | `document_chunks`, `document_tags`, `extraction_metadata`, `processing_jobs`, `embeddings` (all reference `documents.id`, not `auth.users` directly, but lose their parent when the document is deleted) |
| `document_chunks`, `extraction_metadata`, `processing_jobs` | `user_id` | — |
| `notes`, `note_tags` | `user_id` | `note_embeddings` |
| `conversations` | `user_id` | `messages`, `message_embeddings` |
| `messages` | `user_id` | — |
| `ai_memory` | `user_id` | — |
| `ai_requests` | `user_id` | — |
| `assets` | `owner_id` | `asset_embeddings` |
| `workspaces` | `user_id` (creator/owner) | see "Shared workspace" behavior below |
| `workspace_members` | `user_id` | — |
| `workspace_objectives` | `user_id` | — |
| `knowledge_nodes`, `knowledge_node_sources`, `knowledge_links` | `user_id` | — |
| `knowledge_collections` | `user_id` | — |
| `provider_overrides` | `user_id` | — |
| `reading_progress`, `highlights`, `flashcards`, `chapter_summaries` | `user_id` | — |
| `dismissed_suggestions` | `user_id` | — |
| `platform_admins` | `user_id` (primary key) | — see "Founder/admin protection" below; this table's own cascade is irrelevant because admin accounts are never allowed to reach deletion in the first place |

## Tables that reference a user but must NOT cascade-delete on that user's account removal

| Table | Column | Behavior | Why |
|---|---|---|---|
| `workspace_invitations` | `invited_by` | `on delete set null` | The invitation record (and the invited email) is a legitimate historical fact belonging to the workspace, not solely to the inviter — it must survive the inviter's account being deleted. |
| `workspace_members` | `invited_by` | `on delete set null` | Same reasoning — a membership row's own `user_id` (the member) still cascades correctly; only the "who invited them" attribution is nulled, not the membership itself. |
| Every content table's `workspace_id` (`documents`, `notes`, `assets`, `conversations`, `ai_memory`, `knowledge_nodes`, `knowledge_collections`, `document_chunks` — 11 tables total) | `workspace_id` | `on delete set null` | **The critical safety property.** If a deleted user owned a shared workspace, the `workspaces` row cascades away — but every OTHER member's content in that workspace only has its `workspace_id` set to null (becomes a personal, non-workspace item). Their actual content (the document/note/asset/conversation/memory/knowledge-node row itself) is never touched, because it's owned by their own `user_id`, not the deleted user's. Confirmed directly by inspecting every `references public.workspaces (id)` foreign key in the schema — all 11 use `set null`, none use `cascade`. |

## What cascade does NOT reach (and this sprint's deletion handles explicitly)

1. **Supabase Storage objects.** Files (`documents` and `assets` buckets, both organized as `${userId}/...`) are not database rows — deleting a `documents`/`assets` table row does not delete the underlying file bytes. `delete-account`'s edge function recursively lists and removes every object under the caller's own `${userId}/` prefix in both buckets before deleting the Auth account, using `src/shared/lib/collectStorageFilePaths.ts` (tested — see its own test file for the recursion/pagination behavior pinned).
2. **The `auth.users` row itself.** No table-level delete reaches Supabase Auth's own user record — only the Admin API (`auth.admin.deleteUser`), which requires the service-role key and can therefore only run inside an Edge Function, never client-side. This is exactly what `delete-account`'s final step does, after Storage cleanup succeeds.

## Founder/admin protection

The platform has one bootstrap admin account (`platform_admins`, `0035_platform_admin_foundation.sql`) plus whichever accounts are ever subsequently granted admin the same way. Authorization is **role-based**, not identity-based:

- `platform_admins` is a table with zero client write policies at all — granting admin status is only ever a manual, out-of-band SQL statement, never reachable from the app.
- `is_platform_admin(uid)` (SQL, `SECURITY DEFINER`) is the one function every admin-gated operation checks.
- `delete-account` calls `is_platform_admin()` as the caller, before doing anything else, and refuses (403) if true.

This means the rule is "no admin account can self-delete," enforced by role, not "block this one specific email/user id" — no email address or UUID is hardcoded into the deletion logic itself. (The bootstrap migration's one-time `insert into platform_admins values ('23c725ec-...', ...)` is data, applied once, not a check in application code — see `0035_platform_admin_foundation.sql`'s own header comment for why that distinction was deliberate from the start.)

## Deletion contract (what was implemented)

Self-service only — a user can delete only their own account, identified by their own session JWT. There is no "delete another user" path anywhere in this implementation; the edge function never accepts a target user id from the request body.

**On success, in order:**
1. Caller authenticated via their own JWT (401 if missing/invalid).
2. `is_platform_admin()` checked as the caller — refused (403) if true.
3. Every Storage object under `${userId}/` in the `documents` bucket is listed (recursively, paginated) and removed.
4. Every Storage object under `${userId}/` in the `assets` bucket is listed (recursively, paginated) and removed.
5. `auth.admin.deleteUser(userId)` is called — this cascades every table in the first section above automatically, and `set null`s every *other* user's `workspace_id` reference if the deleted user owned a shared workspace.

**On any failure** (Storage listing/removal error, `deleteUser` error), the request returns a clear error and nothing further proceeds — a partial deletion is never silently left half-done from the caller's perspective (though a Storage-removal failure after some objects were already removed is possible in principle; retrying the same deletion is safe and idempotent, since a re-run simply finds fewer or zero remaining objects and still succeeds).

## What is explicitly out of scope

- **Admin-initiated deletion of another user's account.** A materially different feature with its own authorization model (which admin roles can delete which users, audit logging, notification) — not built here, not needed to close the P1 this sprint targeted (self-service deletion).
- **A grace period / soft delete / "restore within 30 days" flow.** The implementation here is an immediate, irreversible hard delete — the most common, least ambiguous interpretation of "delete my account." A soft-delete option remains a legitimate future enhancement, not a blocker this sprint needed to resolve; see `docs/arriyia-personal-release-backlog.md`.
