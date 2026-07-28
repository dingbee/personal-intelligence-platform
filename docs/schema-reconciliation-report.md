# Schema Reconciliation Report

**Date:** 2026-07-28
**Status:** Audit only — no database changes made in this task.
**Method:** Live schema inspected directly against the `uzshazetfkjkrdnxwjtl` Supabase project via `information_schema`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_trigger`/`information_schema.triggers`, and `pg_enum`; compared line-by-line against every file under `supabase/migrations/`.

## Summary verdict

| Table | Production | Repo migration | Status |
|---|---|---|---|
| `highlights` | exists | `0008_reading_workspace.sql` | **In sync** — every column, type, key, index, trigger, and RLS policy matches exactly |
| `chapter_summaries` | exists | `0008_reading_workspace.sql` | **In sync** |
| `flashcards` | exists | `0008_reading_workspace.sql` | **In sync** |
| `notes` | exists | **none** | **Drift — untracked** |
| `note_tags` | exists | **none** | **Drift — untracked** |
| `knowledge_links` | exists | **none** | **Drift — untracked** |
| `ai_memory` | exists | **none** | **Drift — untracked** |

Repo-wide search (`grep -ril` across `supabase/migrations/`) confirms the only occurrences of "notes"/"knowledge_links"/"ai_memory" anywhere in the migration history are two prose comments in `0007_search.sql` and `0008_reading_workspace.sql` referencing a future "Milestone 7" — never an actual `CREATE TABLE`. These four tables exist in production with no corresponding migration file at all; a fresh environment built from this repo's migrations alone would be missing them entirely.

---

## `highlights` — in sync

**Production columns:**
| column | type | nullable | default |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| document_id | uuid | no | — |
| user_id | uuid | no | — |
| chapter_index | integer | yes | — |
| quote | text | no | — |
| note | text | yes | — |
| created_at | timestamptz | no | `now()` |
| updated_at | timestamptz | no | `now()` |

**Keys:** `PRIMARY KEY (id)`. FKs: `document_id → documents(id) ON DELETE CASCADE`, `user_id → auth.users(id) ON DELETE CASCADE`.
**Indexes:** `highlights_pkey` (id), `highlights_document_id_idx` (document_id).
**RLS:** enabled, not forced. One `ALL` policy, "Users manage their own highlights", `USING/WITH CHECK (auth.uid() = user_id)`.
**Triggers:** `set_highlights_updated_at` (BEFORE UPDATE → `set_updated_at()`).
**Enums:** none.

Matches `supabase/migrations/0008_reading_workspace.sql:15-27,50,53-55,66,75-78` exactly.

## `chapter_summaries` — in sync

**Production columns:**
| column | type | nullable | default |
|---|---|---|---|
| document_id | uuid | no | — |
| user_id | uuid | no | — |
| chapter_index | integer | no | — |
| content | text | no | — |
| model | text | no | — |
| created_at | timestamptz | no | `now()` |
| updated_at | timestamptz | no | `now()` |

**Keys:** `PRIMARY KEY (document_id, chapter_index)` — composite, no surrogate `id`. FKs: `document_id → documents(id) ON DELETE CASCADE`, `user_id → auth.users(id) ON DELETE CASCADE`.
**Indexes:** `chapter_summaries_pkey` (document_id, chapter_index) only.
**RLS:** enabled, not forced. One `ALL` policy, "Users manage their own chapter summaries", `auth.uid() = user_id`.
**Triggers:** `set_chapter_summaries_updated_at` (BEFORE UPDATE → `set_updated_at()`).
**Enums:** none.

Matches `0008_reading_workspace.sql:29-38,61-63,80-83` exactly. Note the composite PK omits `user_id` — ownership is enforced transitively through `document_id` (a user can only have `documents` rows they own) plus RLS, not through the PK itself. This is a pre-existing design choice, not something this reconciliation changes.

## `flashcards` — in sync

**Production columns:**
| column | type | nullable | default |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| document_id | uuid | no | — |
| user_id | uuid | no | — |
| chapter_index | integer | yes | — |
| front | text | no | — |
| back | text | no | — |
| created_at | timestamptz | no | `now()` |

**Keys:** `PRIMARY KEY (id)`. FKs: `document_id → documents(id) ON DELETE CASCADE`, `user_id → auth.users(id) ON DELETE CASCADE`.
**Indexes:** `flashcards_pkey` (id), `flashcards_document_id_idx` (document_id).
**RLS:** enabled, not forced. One `ALL` policy, "Users manage their own flashcards", `auth.uid() = user_id`.
**Triggers:** none — **no `updated_at` column exists**, so no update trigger, unlike every other table in this set. Confirmed intentional (flashcards are generated once and replaced by delete+insert in application code, per the existing `runCapability`/`createFlashcards` pattern — not edited in place).
**Enums:** none.

Matches `0008_reading_workspace.sql:40-47,51,68,85-88` exactly.

---

## `notes` — drift (untracked in repo)

**Production columns:**
| column | type | nullable | default |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| user_id | uuid | no | — |
| workspace_id | uuid | yes | — |
| collection_id | uuid | yes | — |
| document_id | uuid | yes | — |
| title | text | no | `'Untitled note'` |
| content | text | no | `''` |
| created_at | timestamptz | no | `now()` |
| updated_at | timestamptz | no | `now()` |

**Keys:** `PRIMARY KEY (id)`. FKs: `user_id → auth.users(id) ON DELETE CASCADE`, `workspace_id → workspaces(id) ON DELETE SET NULL`, `collection_id → collections(id) ON DELETE SET NULL`, `document_id → documents(id) ON DELETE SET NULL`.
**Indexes:** `notes_pkey` (id), `notes_user_id_idx`, `notes_workspace_id_idx`, `notes_collection_id_idx`, `notes_document_id_idx`.
**RLS:** enabled, not forced. One `ALL` policy, "Users manage their own notes", `auth.uid() = user_id`.
**Triggers:** `set_notes_updated_at` (BEFORE UPDATE → `set_updated_at()`).
**Enums:** none.

Design notes: `document_id`/`collection_id` are both nullable with `ON DELETE SET NULL` — a note can exist standalone, attached to a document, filed in a collection, or both/neither. This is a deliberately general-purpose note model, not document-only.

## `note_tags` — drift (untracked in repo)

Pure junction table, reusing the same `tags` table documents already tag against.

**Production columns:** `note_id uuid not null`, `tag_id uuid not null`.
**Keys:** `PRIMARY KEY (note_id, tag_id)`. FKs: `note_id → notes(id) ON DELETE CASCADE`, `tag_id → tags(id) ON DELETE CASCADE`.
**Indexes:** `note_tags_pkey` (note_id, tag_id) only.
**RLS:** enabled, not forced. One `ALL` policy, "Users manage tags on their own notes": `EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())` — same ownership-through-parent pattern as `document_tags`.
**Triggers:** none (no timestamp columns).
**Enums:** none.

## `knowledge_links` — drift (untracked in repo)

A generic, polymorphic graph-edge table — not specific to any one entity type.

**Production columns:**
| column | type | nullable | default |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| user_id | uuid | no | — |
| workspace_id | uuid | yes | — |
| source_type | text | no | — |
| source_id | uuid | no | — |
| target_type | text | no | — |
| target_id | uuid | no | — |
| created_at | timestamptz | no | `now()` |

**Keys:** `PRIMARY KEY (id)`. FKs: `user_id → auth.users(id) ON DELETE CASCADE`, `workspace_id → workspaces(id) ON DELETE SET NULL`. **`source_id`/`target_id` are plain `uuid` with no FK** — necessarily, since `source_type`/`target_type` determine which table they actually point into (documents, notes, etc.); this is enforced by application code, not the database.
**Indexes:** `knowledge_links_pkey` (id), `knowledge_links_source_type_source_id_target_type_target_id_key` (**UNIQUE** on all four columns — prevents duplicate identical edges), `knowledge_links_source_idx` (source_type, source_id), `knowledge_links_target_idx` (target_type, target_id) — both directions indexed for graph traversal.
**RLS:** enabled, not forced. One `ALL` policy, "Users manage their own knowledge links", `auth.uid() = user_id`.
**Triggers:** none (no `updated_at` column — edges are immutable once created; delete+recreate to change one).
**Enums:** none — `source_type`/`target_type` are unconstrained `text`, not a Postgres enum or check constraint. No values currently in use (table is empty in production and zero frontend code references it).

## `ai_memory` — drift (untracked in repo)

**Production columns:**
| column | type | nullable | default |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| user_id | uuid | no | — |
| workspace_id | uuid | yes | — |
| memory_type | `ai_memory_type` (enum) | no | — |
| content | text | no | — |
| source | text | yes | — |
| created_at | timestamptz | no | `now()` |
| updated_at | timestamptz | no | `now()` |

**Keys:** `PRIMARY KEY (id)`. FKs: `user_id → auth.users(id) ON DELETE CASCADE`, `workspace_id → workspaces(id) ON DELETE SET NULL`.
**Indexes:** `ai_memory_pkey` (id) only.
**RLS:** enabled, not forced. One `ALL` policy, "Users manage their own AI memory", `auth.uid() = user_id`.
**Triggers:** `set_ai_memory_updated_at` (BEFORE UPDATE → `set_updated_at()`).
**Enums:** `ai_memory_type` — a genuine Postgres enum type, not present anywhere in this repo's migrations, with exactly three values: `explicit_profile`, `learned_preference`, `conversation_memory`. Design intent (from the values alone): user-level, cross-document AI personalization memory (explicit user-stated preferences, learned patterns, conversation-derived facts) — not per-document content, since there's no `document_id` column at all.

---

## Risk assessment for reconciliation

- **Row counts (checked directly)**: `note_tags`, `knowledge_links`, `ai_memory` are empty. **`notes` has 2 existing rows** — real production data, created outside any code in this repo (no frontend writes to `notes` at all, confirmed in the Phase 4 audit), so it predates or bypasses the application entirely. This makes the reconciliation migration's `IF NOT EXISTS` guard non-optional for `notes` specifically: it must describe the table without recreating it, or those 2 rows would be lost. The other three tables carry no such immediate risk, but the same guard is used uniformly for consistency and future safety.
- **No naming/type conflicts**: none of the four drifted tables' names, column names, or the `ai_memory_type` enum collide with anything already declared across `0001`–`0009`.
- **Ordering dependency**: `note_tags` depends on `notes` and `tags`; `knowledge_links`/`ai_memory` depend on `workspaces`; `notes` depends on `workspaces`/`collections`/`documents`. All of these already exist in earlier migrations (`0002_library.sql`, `0004_workspaces.sql`), so a single new migration can safely declare all four in dependency order (`ai_memory_type` enum → `notes` → `note_tags` → `knowledge_links` → `ai_memory`) with no forward references.
- **The one thing to get exactly right**: the reconciliation migration must reproduce production's *actual* current state (including the fact that `flashcards`/`knowledge_links`/`note_tags` intentionally have no `updated_at`, and `chapter_summaries`' PK intentionally excludes `user_id`) rather than a "cleaner" idealized version — Task 2 uses `IF NOT EXISTS` guards and the exact column/constraint set documented above for this reason.
