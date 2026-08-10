/**
 * Hand-written subset of the Supabase schema used through Milestone 6.
 * Regenerate with the Supabase CLI (`supabase gen types typescript`) once
 * the schema grows past what's practical to hand-maintain.
 */
// `type` rather than `interface` on purpose: interfaces don't get an
// implicit index signature, so they fail the `Record<string, unknown>`
// structural check supabase-js's generics rely on to resolve table types.
export type Profile = {
  id: string
  email: string
  display_name: string | null
  default_chat_provider_id: string | null
  created_at: string
  updated_at: string
}

export type DocumentFileType = 'pdf' | 'epub' | 'docx' | 'txt' | 'markdown' | 'xlsx' | 'csv' | 'ods'
export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error'
export type ProcessingStatus =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'completed'
  | 'failed'

export type Workspace = {
  id: string
  user_id: string
  name: string
  /** Null = active. Archived workspaces are hidden from the switcher but restorable. */
  archived_at: string | null
  /** Display order within a user's workspaces, ascending. New workspaces get max+1. */
  sort_order: number
  created_at: string
  updated_at: string
}

/** UX-14.5 Phase 1 — ordered lowest to highest; a role "meets" a minimum if its rank is >= that minimum's rank, mirroring the SQL has_workspace_role helper. */
export type WorkspaceMemberRole = 'viewer' | 'editor' | 'owner'
export type WorkspaceMemberStatus = 'active' | 'pending' | 'removed'

/**
 * UX-14.5 Phase 1 — Identity Foundation (`0028_workspace_members.sql`).
 * The workspace's creator gets an explicit `owner` row auto-created by a
 * database trigger for every workspace created from that migration
 * forward; workspaces that predate it have zero rows here and resolve
 * their owner implicitly via `Workspace.user_id` instead (see
 * `resolveWorkspaceRole`) — this table is never backfilled for them.
 */
export type WorkspaceMember = {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  status: WorkspaceMemberStatus
  invited_by: string | null
  created_at: string
  updated_at: string
}

/**
 * UX-14.5 Phase 3 — the `list_workspace_members` RPC's row shape: a
 * `WorkspaceMember` joined with the member's email/display name (the
 * function bridges `profiles`' intentionally self-only RLS so the
 * member-management UI can render who's who). `id` is null only for the
 * synthesized implicit-owner row the function returns when a workspace
 * predates the 0028 trigger and has no explicit `workspace_members` row
 * for its creator — that row isn't a real membership row and can't be
 * targeted by role-change/remove actions.
 */
export type WorkspaceMemberWithProfile = Omit<WorkspaceMember, 'id'> & {
  id: string | null
  email: string
  display_name: string | null
}

export type WorkspaceInvitationStatus = 'pending' | 'accepted' | 'cancelled'

/**
 * UX-14.5.8 Phase 1 — an invitation to an email address with no matching
 * `profiles` row at invite time (`0032_workspace_invitations.sql`).
 * Separate from `WorkspaceMember`'s own `status: 'pending'` rows, which
 * are for a *known* user (`user_id` is `not null` there) — this table
 * exists specifically because there is no `user_id` to write yet. `email`
 * is always stored lower-cased. `handle_new_user` resolves a row into a
 * real, active `WorkspaceMember` automatically the moment someone signs
 * up with a matching email, then marks it `accepted` here — there is no
 * separate accept/decline action for the invitee the way an existing
 * user's `WorkspaceMember` pending row has.
 */
export type WorkspaceInvitation = {
  id: string
  workspace_id: string
  email: string
  role: Exclude<WorkspaceMemberRole, 'owner'>
  status: WorkspaceInvitationStatus
  invited_by: string | null
  created_at: string
  updated_at: string
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
}

export type Collection = {
  id: string
  user_id: string
  workspace_id: string | null
  parent_id: string | null
  name: string
  created_at: string
  updated_at: string
}

export type DocumentRow = {
  id: string
  user_id: string
  workspace_id: string | null
  collection_id: string | null
  title: string
  file_name: string
  file_path: string
  file_type: DocumentFileType
  file_size: number
  status: DocumentStatus
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type DocumentTag = {
  document_id: string
  tag_id: string
}

export type ProcessingJob = {
  id: string
  document_id: string
  user_id: string
  status: ProcessingStatus
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ExtractionChapterSummary = { index: number; title: string }

/**
 * Multimodal Intelligence v1 — Document Intelligence: structured
 * classification/extraction over a document's already-extracted text, no
 * new AI runtime capability needed (pure text in, text out, same
 * runCapability path knowledge extraction already uses). Every field is
 * "only what's explicitly present" — empty arrays are the honest default,
 * not an error, for a document with no dates/decisions/tasks in it.
 */
export type DocumentIntelligence = {
  documentType: string
  dates: { label: string; date: string }[]
  decisions: string[]
  tasks: { description: string; owner: string | null }[]
  analyzedAt: string
  provider: string
}

export type ExtractionMetadata = {
  document_id: string
  user_id: string
  title: string | null
  author: string | null
  language: string | null
  page_count: number | null
  chapter_count: number | null
  word_count: number | null
  char_count: number | null
  /** `spreadsheet` (UX-13.10) holds SheetAnalysis[] from `@/modules/processing/spreadsheet/types` — kept as `unknown[]` here so shared/types doesn't depend on a feature module; readers should go through `getSpreadsheetAnalysis` in `@/modules/processing/api/extractionMetadata` rather than casting this directly. `documentIntelligence` (Multimodal Intelligence v1) is fully typed here since it has no feature-module dependency of its own. */
  metadata: { chapters?: ExtractionChapterSummary[]; spreadsheet?: unknown[]; documentIntelligence?: DocumentIntelligence } & Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DocumentChunk = {
  id: string
  document_id: string
  user_id: string
  workspace_id: string | null
  chunk_index: number
  content: string
  char_start: number
  char_end: number
  token_count: number
  chapter_index: number | null
  chapter_title: string | null
  created_at: string
}

export type Embedding = {
  id: string
  chunk_id: string
  model: string
  embedding: number[]
  created_at: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export type Conversation = {
  id: string
  user_id: string
  workspace_id: string | null
  document_id: string | null
  title: string
  provider_id: string
  /** UX-13.5B: null = active/visible. Set = archived — hidden from the default list but restorable. Mirrors workspaces.archived_at. */
  archived_at: string | null
  /** UX-13.6: pinned conversations sort first within the active list, independent of recency. */
  is_pinned: boolean
  /** UX-13.6: a separate flag from is_pinned — "pin to top" and "mark as favorite" are different user intents even though both are booleans. */
  favorite: boolean
  /** UX-13.6: reserved for a future custom-color affordance — no UI reads/writes this yet. */
  color: string | null
  /** UX-13.6: reserved for a future custom-icon affordance — no UI reads/writes this yet. */
  icon: string | null
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  conversation_id: string
  user_id: string
  role: MessageRole
  content: string
  context_chunk_ids: string[]
  created_at: string
}

export type MessageEmbedding = {
  id: string
  message_id: string
  model: string
  embedding: number[]
  created_at: string
}

export type NoteEmbedding = {
  id: string
  note_id: string
  model: string
  embedding: number[]
  created_at: string
}

export type ReadingProgress = {
  document_id: string
  user_id: string
  chapter_index: number
  scroll_fraction: number
  updated_at: string
}

export type Highlight = {
  id: string
  document_id: string
  user_id: string
  chapter_index: number | null
  quote: string
  note: string | null
  /** Chunk ids this was derived from, when AI-generated. Null for user-authored highlights (the normal case). */
  source_chunk_ids: string[] | null
  generation_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type ChapterSummary = {
  document_id: string
  user_id: string
  chapter_index: number
  content: string
  model: string
  /** Chunk ids the summary was generated from. Null for rows created before provenance tracking existed. */
  source_chunk_ids: string[] | null
  generation_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type Flashcard = {
  id: string
  document_id: string
  user_id: string
  chapter_index: number | null
  front: string
  back: string
  /** Chunk ids the flashcard was generated from. Null for rows created before provenance tracking existed. */
  source_chunk_ids: string[] | null
  generation_metadata: Record<string, unknown> | null
  created_at: string
}

export type Note = {
  id: string
  user_id: string
  workspace_id: string | null
  collection_id: string | null
  document_id: string | null
  title: string
  content: string
  /** Chunk ids this was derived from, when AI-assisted. Null for hand-written notes (the normal case). */
  source_chunk_ids: string[] | null
  generation_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type NoteTag = {
  note_id: string
  tag_id: string
}

/** A polymorphic graph edge between two entities (e.g. a document and a note) — source_type/target_type determine what source_id/target_id point into; not FK-enforced at the DB level. */
export type KnowledgeLink = {
  id: string
  user_id: string
  workspace_id: string | null
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  created_at: string
  /** Null for links created before Phase 7A (e.g. note<->highlight) — those derive a display label at query time instead. Set for AI-generated edges. */
  relationship_type: string | null
  confidence: number | null
  /** e.g. 'ai:detect-relationships'. Null for user-authored links. */
  generated_by: string | null
  metadata: Record<string, unknown> | null
}

/**
 * UX-13 roadmap Phase 4 — Knowledge Collections: identity/metadata only.
 * Membership is not a column here — it's rows in the existing generic
 * `knowledge_links` table (source_type='knowledge_collection',
 * source_id=this id), the same polymorphic-link pattern
 * linkNoteToHighlight/linkNoteToConversation/linkNoteToAsset already use.
 */
export type KnowledgeCollection = {
  id: string
  user_id: string
  workspace_id: string | null
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type KnowledgeNodeType = 'concept' | 'entity'

/**
 * An AI-extracted concept or entity. `source_type`/`source_id` remain the
 * node's original/first source (unchanged pre-Phase 9A meaning, still what
 * the Explorer/Graph UI reads) — `knowledge_node_sources` is the complete,
 * possibly-multi-document provenance ledger (Phase 9A). Not a user-authored
 * object — see Phase 7A audit for why this doesn't reuse tags.
 */
export type KnowledgeNode = {
  id: string
  user_id: string
  workspace_id: string | null
  node_type: KnowledgeNodeType
  title: string
  /** Phase 9A: lowercase, whitespace/punctuation-normalized title — the canonical-identity lookup key within (user_id, node_type). */
  title_normalized: string
  description: string | null
  source_type: string
  source_id: string
  source_chunk_ids: string[] | null
  generation_metadata: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Phase 9A: one row per (node, document) it was actually extracted from — the full provenance ledger a canonical, possibly-multi-source node accumulates over time. */
export type KnowledgeNodeSource = {
  id: string
  user_id: string
  node_id: string
  source_type: string
  source_id: string
  source_chunk_ids: string[] | null
  created_at: string
}

export type AiMemoryType = 'explicit_profile' | 'learned_preference' | 'conversation_memory'

export type AiMemory = {
  id: string
  user_id: string
  workspace_id: string | null
  memory_type: AiMemoryType
  content: string
  source: string | null
  /** Phase UX-5.3A: false = disabled (individually, or via a category-wide toggle) — excluded from retrieval/prompt injection but not deleted. */
  is_active: boolean
  created_at: string
  updated_at: string
  /** UX-14.3 — 0..1, from scoreMemoryConfidence at approval time. Null for every row created before this column existed, and for manually-authored memories/profile fields, which aren't inferences and have no natural confidence value. */
  confidence: number | null
}

export type ProviderOverride = {
  id: string
  user_id: string
  provider_id: string
  enabled: boolean | null
  reason: string | null
  updated_at: string
  created_at: string
}

export type AiRequestStatus = 'success' | 'error'

export type AiRequest = {
  id: string
  user_id: string
  workspace_id: string | null
  feature: string
  provider: string
  model: string | null
  tokens_input: number | null
  tokens_output: number | null
  latency_ms: number
  status: AiRequestStatus
  error_message: string | null
  /** Phase 8C: the provider the router chose first — set on every routed request, even when it matches `provider` (i.e. no fallback happened). Null for requests logged before this phase. */
  requested_provider: string | null
  /** Set only on the row where `provider` differs from `requested_provider` — the one that succeeded after an earlier candidate failed. */
  fallback_reason: string | null
  created_at: string
}

export type WorkspaceObjectiveStatus = 'active' | 'done' | 'dismissed'

export type WorkspaceObjective = {
  id: string
  workspace_id: string
  user_id: string
  content: string
  status: WorkspaceObjectiveStatus
  created_at: string
  updated_at: string
}

/** AI Experience Intelligence v1 — a user's dismissal of one proactive-intelligence item (a Hub IntelligenceItem or a dashboard-scope Recommendation), keyed by the caller-derived item_key. See 0037_dismissed_suggestions.sql. */
export type DismissedSuggestion = {
  id: string
  workspace_id: string
  user_id: string
  item_key: string
  dismissed_at: string
}

/** UX-13.8.2 — an uploaded image and its generated derivatives. Deliberately not a `documents` row; see the 0022_assets.sql migration header. */
/**
 * Multimodal Intelligence v1/v2 — AI-generated interpretation of an
 * image, stored honestly: a description and any visible text NOVA read,
 * not a calibrated OCR confidence score (no provider in this codebase
 * exposes one). `confidence` (v2) is the model's own self-reported
 * estimate, not a statistical guarantee — see
 * docs/multimodal-intelligence-v2-discovery.md §5. `documentIntelligence`
 * (v2) reuses the exact same type documents get, applied to this asset's
 * analyzed text via runDocumentIntelligenceFromContent.
 */
export type AssetAnalysis = {
  description: string
  extractedText: string | null
  detectedLanguage: string | null
  confidence: { text: number | null; entities: number | null; relationships: number | null } | null
  documentIntelligence: DocumentIntelligence | null
  analyzedAt: string
  provider: string
}

export type Asset = {
  id: string
  workspace_id: string | null
  owner_id: string
  title: string
  original_path: string
  optimized_path: string
  thumbnail_path: string
  mime_type: string
  width: number
  height: number
  size_bytes: number
  created_at: string
  metadata: AssetAnalysis | null
}

/** Multimodal Intelligence v2 — Universal Search's fourth source type, mirroring NoteEmbedding exactly. See 0039_asset_search.sql. */
export type AssetEmbedding = {
  id: string
  asset_id: string
  model: string
  embedding: number[]
  created_at: string
}

/** Beta / Admin / AI Governance Foundation (0035_platform_admin_foundation.sql). Not a `profiles` column — see that migration's own header for why. RLS: a user may SELECT only their own row; no client write policy exists at all — granting admin status is a manual, out-of-band SQL statement, never client-reachable. */
export type PlatformAdmin = {
  user_id: string
  granted_at: string
  granted_by: string | null
}

/** Founder Command Center (0036_founder_command_center.sql). Platform-wide provider governance — genuinely new; `provider_overrides` is per-user only. RLS: authenticated-read-all (so `resolveProviderChain` can factor it in client-side); zero client write policies, write only via `admin_set_platform_provider_setting`. `enabled: false` can only REMOVE a provider from the eligible set — never overrides the existing key-presence/`isProviderAvailable` check. */
export type PlatformProviderSetting = {
  provider_id: string
  enabled: boolean
  priority: number
  updated_by: string | null
  updated_at: string
}

export type BetaInviteStatus = 'invited' | 'accepted'

/**
 * Beta Invite + Quota Reconciliation & Repair — `beta_invites`/`plans`/
 * `plan_quotas`/`user_plan_assignments`/`quota_usage` were created
 * manually in the Supabase dashboard (not via any migration in this
 * repo); `0034_beta_invite_quota_repair.sql` captures the live schema
 * and repairs four confirmed defects found there (see that file's own
 * header) without redesigning the manual work. RLS on this table is
 * enabled with zero client policies — the only access paths are the
 * SECURITY DEFINER functions below (`is_beta_invited`,
 * `assign_default_plan`, the `enforce_beta_invite_gate` trigger).
 */
export type BetaInvite = {
  id: string
  email: string
  status: BetaInviteStatus
  full_name: string | null
  organization: string | null
  invited_by: string | null
  created_at: string
  accepted_at: string | null
  plan_id: string | null
  accepted_by: string | null
}

export type Plan = {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
  created_at: string
  /** Phase 5A (0049_plan_commercial_control.sql) — configuration/data only, never read by entitlement or quota logic. Null until a real price is decided (no payment provider is selected yet). */
  monthly_price_cents: number | null
  annual_price_cents: number | null
  currency: string
}

/**
 * Phase 5A — the plan -> allowed-AI-provider matrix. `provider_id` is a
 * bare string key (e.g. "anthropic") matching `providerRegistry`'s ids
 * and `platform_provider_settings.provider_id` — never a display label or
 * model name. RLS: authenticated-read-all (resolveProviderChain reads a
 * user's own plan's allowed set client-side); all writes go through
 * `admin_set_plan_ai_provider` (SECURITY DEFINER, is_platform_admin()-
 * gated).
 */
export type PlanAiProvider = {
  id: string
  plan_id: string
  provider_id: string
  priority: number
  active: boolean
  updated_by: string | null
  updated_at: string
}

export type PlanQuota = {
  id: string
  plan_id: string
  quota_key: string
  quota_limit: number
  quota_period: string
  created_at: string
}

/** RLS: a user can SELECT their own row only. All writes go through `admin_set_user_quota_override`/`admin_remove_user_quota_override` (SECURITY DEFINER) — see 0041_user_quota_overrides.sql. Absence of a row for a (user_id, quota_key) pair means "use the plan default"; `resolve_effective_quota_limit()` is the one place that resolves override-vs-plan. */
export type UserQuotaOverride = {
  id: string
  user_id: string
  quota_key: string
  quota_limit: number
  created_at: string
  updated_at: string
  updated_by: string | null
}

/** RLS: a user can SELECT their own row only. All writes go through `assign_default_plan` (SECURITY DEFINER, fires on `auth.users` insert) — see 0034_beta_invite_quota_repair.sql. */
export type UserPlanAssignment = {
  id: string
  user_id: string
  plan_id: string
  starts_at: string
  ends_at: string | null
  active: boolean
  created_at: string
}

/** RLS: a user can SELECT their own row only. All writes go through the `consume_quota` RPC (SECURITY DEFINER, atomic upsert) — see 0034_beta_invite_quota_repair.sql. Query by `period_start` to get the current period's row (quotaService.checkQuota does this); the table is period-scoped (`UNIQUE(user_id, quota_key, period_start)`), a new row is created per calendar month. */
export type QuotaUsage = {
  id: string
  user_id: string
  quota_key: string
  usage_count: number
  period_start: string
  period_end: string
  created_at: string
  updated_at: string
}

/**
 * Phase 4 Commercial Architecture (0047_billing_tables_and_subscription_-
 * event_function.sql). RLS: a user can SELECT their own row only. All
 * writes go through `apply_subscription_event` (SECURITY DEFINER, granted
 * to `service_role` only — never `anon`/`authenticated`), called from the
 * billing webhook Edge Function after signature verification. This is the
 * billing *relationship* record, not the entitlement itself —
 * `user_plan_assignments` (unchanged) remains the only table that actually
 * grants plan access.
 */
export type BillingCustomer = {
  id: string
  user_id: string
  provider: string
  provider_customer_id: string
  created_at: string
  updated_at: string
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired'

/** RLS: a user can SELECT their own row only. All writes go through `apply_subscription_event`, same as `BillingCustomer` above. */
export type Subscription = {
  id: string
  user_id: string
  plan_id: string
  provider: string
  provider_subscription_id: string
  provider_price_id: string | null
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  last_event_at: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionEventProcessingStatus = 'pending' | 'processed' | 'ignored_stale' | 'failed'

/** RLS: zero client policies (matches `BetaInvite`'s pattern) — the only access paths are `apply_subscription_event` (service-role only) and `admin_get_user_subscription`. Not exposed through any client `.from('subscription_events')` call site; included here purely so `apply_subscription_event`'s server-side effects are fully typed. */
export type SubscriptionEvent = {
  id: string
  provider: string
  provider_event_id: string
  event_type: string
  subscription_id: string | null
  processing_status: SubscriptionEventProcessingStatus
  raw_payload: Record<string, unknown> | null
  received_at: string
  processed_at: string | null
}

export type PesapalCheckoutOrderStatus = 'pending' | 'completed' | 'failed'

/**
 * Phase 5B Pesapal Sandbox Billing — the server-controlled mapping from a
 * Pesapal checkout attempt back to an ARRIYIA user_id/plan_code, created
 * by the pesapal-checkout Edge Function and updated by pesapal-ipn once
 * Pesapal's GetTransactionStatus confirms an outcome. RLS: a user can
 * SELECT their own rows only (drives BillingReturnPage's "payment being
 * confirmed" polling state); all writes are service-role only, from
 * those two Edge Functions.
 */
export type PesapalCheckoutOrder = {
  id: string
  user_id: string
  merchant_reference: string
  plan_code: string
  amount_cents: number
  currency: string
  order_tracking_id: string | null
  status: PesapalCheckoutOrderStatus
  created_at: string
  updated_at: string
}

export type FoundingProApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'enrolled'

/**
 * Founding Pro Programme Phase 1 (0052_founding_pro_programme_foundation.sql).
 * An application never consumes a public slot by itself — only
 * `admin_enroll_founding_pro_member` (once the application is `approved`)
 * does that. RLS: a user can SELECT their own row only; there is no
 * client INSERT policy or submission RPC yet (deliberately out of scope
 * for Phase 1 — see the migration header). The partial unique index on
 * `(user_id) where status in ('pending','approved')` is what actually
 * enforces "one active application per user", not application code.
 */
export type FoundingProApplication = {
  id: string
  user_id: string
  status: FoundingProApplicationStatus
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export type FoundingProMemberSlotType = 'public' | 'grandfathered'
export type FoundingProMemberTransitionStatus = 'active' | 'transitioned'

/**
 * `founding_member_number` is 1-100 for `slot_type = 'public'` and always
 * null for `slot_type = 'grandfathered'` — enforced by a structural CHECK
 * constraint, not just this type. `founding_price_cents`/`currency` are
 * whatever an admin actually supplied at enrollment time (never derived
 * from `plans.monthly_price_cents`) and are permanently immune to later
 * edits of that plan's price. RLS: a user can SELECT their own row only;
 * all writes go through `admin_enroll_founding_pro_member`.
 */
export type FoundingProMember = {
  id: string
  user_id: string
  application_id: string | null
  slot_type: FoundingProMemberSlotType
  founding_member_number: number | null
  founding_price_cents: number
  currency: string
  founding_started_at: string
  founding_expires_at: string
  transition_status: FoundingProMemberTransitionStatus
  transitioned_at: string | null
  created_at: string
}

/**
 * Singleton row (`id` is always 1) — the sole lockable counter behind the
 * atomic 100-slot public cap. RLS: zero client policies; the only read
 * path is `get_founding_pro_public_capacity()`, and the only write path
 * is the `SELECT ... FOR UPDATE` inside `admin_enroll_founding_pro_member`.
 */
export type FoundingProCapacity = {
  id: number
  max_public_slots: number
  enrolled_public_count: number
  updated_at: string
}

export type FoundingProEventType =
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected'
  | 'application_withdrawn'
  | 'invitation_issued'
  | 'invitation_accepted'
  | 'member_enrolled'
  | 'member_grandfathered'
  | 'transition_completed'
  | 'admin_action'

/**
 * Append-only audit trail — enforced by BEFORE UPDATE/DELETE triggers
 * that unconditionally raise, not merely by the absence of a mutating
 * RPC. RLS: zero client policies; not exposed through any client
 * `.from('founding_pro_events')` call site, included here purely so
 * `admin_enroll_founding_pro_member`'s server-side effects are fully typed.
 */
export type FoundingProEvent = {
  id: string
  event_type: FoundingProEventType
  application_id: string | null
  member_id: string | null
  actor_user_id: string | null
  target_user_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string }
        Update: Partial<Profile>
        Relationships: []
      }
      workspaces: {
        Row: Workspace
        Insert: Partial<Workspace> & { user_id: string; name: string }
        Update: Partial<Workspace>
        Relationships: []
      }
      workspace_members: {
        Row: WorkspaceMember
        Insert: Partial<WorkspaceMember> & { workspace_id: string; user_id: string; role: WorkspaceMemberRole }
        Update: Partial<WorkspaceMember>
        Relationships: []
      }
      workspace_invitations: {
        Row: WorkspaceInvitation
        Insert: Partial<WorkspaceInvitation> & { workspace_id: string; email: string; role: Exclude<WorkspaceMemberRole, 'owner'> }
        Update: Partial<WorkspaceInvitation>
        Relationships: []
      }
      collections: {
        Row: Collection
        Insert: Partial<Collection> & { user_id: string; name: string }
        Update: Partial<Collection>
        Relationships: []
      }
      documents: {
        Row: DocumentRow
        Insert: Partial<DocumentRow> & {
          user_id: string
          title: string
          file_name: string
          file_path: string
          file_type: DocumentFileType
          file_size: number
        }
        Update: Partial<DocumentRow>
        Relationships: []
      }
      tags: {
        Row: Tag
        Insert: Partial<Tag> & { user_id: string; name: string }
        Update: Partial<Tag>
        Relationships: []
      }
      document_tags: {
        Row: DocumentTag
        Insert: DocumentTag
        Update: Partial<DocumentTag>
        Relationships: []
      }
      processing_jobs: {
        Row: ProcessingJob
        Insert: Partial<ProcessingJob> & { document_id: string; user_id: string }
        Update: Partial<ProcessingJob>
        Relationships: []
      }
      extraction_metadata: {
        Row: ExtractionMetadata
        Insert: Partial<ExtractionMetadata> & { document_id: string; user_id: string }
        Update: Partial<ExtractionMetadata>
        Relationships: []
      }
      document_chunks: {
        Row: DocumentChunk
        Insert: Partial<DocumentChunk> & {
          document_id: string
          user_id: string
          chunk_index: number
          content: string
          char_start: number
          char_end: number
          token_count: number
        }
        Update: Partial<DocumentChunk>
        Relationships: []
      }
      embeddings: {
        Row: Embedding
        Insert: Partial<Embedding> & { chunk_id: string; model: string; embedding: number[] }
        Update: Partial<Embedding>
        Relationships: []
      }
      message_embeddings: {
        Row: MessageEmbedding
        Insert: Partial<MessageEmbedding> & { message_id: string; model: string; embedding: number[] }
        Update: Partial<MessageEmbedding>
        Relationships: []
      }
      note_embeddings: {
        Row: NoteEmbedding
        Insert: Partial<NoteEmbedding> & { note_id: string; model: string; embedding: number[] }
        Update: Partial<NoteEmbedding>
        Relationships: []
      }
      conversations: {
        Row: Conversation
        Insert: Partial<Conversation> & { user_id: string }
        Update: Partial<Conversation>
        Relationships: []
      }
      messages: {
        Row: Message
        Insert: Partial<Message> & { conversation_id: string; user_id: string; role: MessageRole; content: string }
        Update: Partial<Message>
        Relationships: []
      }
      ai_requests: {
        Row: AiRequest
        Insert: Partial<AiRequest> & {
          user_id: string
          feature: string
          provider: string
          latency_ms: number
          status: AiRequestStatus
        }
        Update: Partial<AiRequest>
        Relationships: []
      }
      provider_overrides: {
        Row: ProviderOverride
        Insert: Partial<ProviderOverride> & { user_id: string; provider_id: string }
        Update: Partial<ProviderOverride>
        Relationships: []
      }
      reading_progress: {
        Row: ReadingProgress
        Insert: Partial<ReadingProgress> & { document_id: string; user_id: string }
        Update: Partial<ReadingProgress>
        Relationships: []
      }
      highlights: {
        Row: Highlight
        Insert: Partial<Highlight> & { document_id: string; user_id: string; quote: string }
        Update: Partial<Highlight>
        Relationships: []
      }
      chapter_summaries: {
        Row: ChapterSummary
        Insert: Partial<ChapterSummary> & {
          document_id: string
          user_id: string
          chapter_index: number
          content: string
          model: string
        }
        Update: Partial<ChapterSummary>
        Relationships: []
      }
      flashcards: {
        Row: Flashcard
        Insert: Partial<Flashcard> & { document_id: string; user_id: string; front: string; back: string }
        Update: Partial<Flashcard>
        Relationships: []
      }
      notes: {
        Row: Note
        Insert: Partial<Note> & { user_id: string }
        Update: Partial<Note>
        Relationships: []
      }
      note_tags: {
        Row: NoteTag
        Insert: NoteTag
        Update: Partial<NoteTag>
        Relationships: []
      }
      knowledge_links: {
        Row: KnowledgeLink
        Insert: Partial<KnowledgeLink> & {
          user_id: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
        }
        Update: Partial<KnowledgeLink>
        Relationships: []
      }
      knowledge_nodes: {
        Row: KnowledgeNode
        Insert: Partial<KnowledgeNode> & {
          user_id: string
          node_type: KnowledgeNodeType
          title: string
          title_normalized: string
          source_type: string
          source_id: string
        }
        Update: Partial<KnowledgeNode>
        Relationships: []
      }
      knowledge_node_sources: {
        Row: KnowledgeNodeSource
        Insert: Partial<KnowledgeNodeSource> & {
          user_id: string
          node_id: string
          source_type: string
          source_id: string
        }
        Update: Partial<KnowledgeNodeSource>
        Relationships: []
      }
      knowledge_collections: {
        Row: KnowledgeCollection
        Insert: Partial<KnowledgeCollection> & { user_id: string; name: string }
        Update: Partial<KnowledgeCollection>
        Relationships: []
      }
      ai_memory: {
        Row: AiMemory
        Insert: Partial<AiMemory> & { user_id: string; memory_type: AiMemoryType; content: string }
        Update: Partial<AiMemory>
        Relationships: []
      }
      workspace_objectives: {
        Row: WorkspaceObjective
        Insert: Partial<WorkspaceObjective> & { workspace_id: string; user_id: string; content: string }
        Update: Partial<WorkspaceObjective>
        Relationships: []
      }
      dismissed_suggestions: {
        Row: DismissedSuggestion
        Insert: Partial<DismissedSuggestion> & { workspace_id: string; user_id: string; item_key: string }
        Update: Partial<DismissedSuggestion>
        Relationships: []
      }
      assets: {
        Row: Asset
        Insert: Partial<Asset> & {
          owner_id: string
          original_path: string
          optimized_path: string
          thumbnail_path: string
          mime_type: string
          width: number
          height: number
          size_bytes: number
        }
        Update: Partial<Asset>
        Relationships: []
      }
      asset_embeddings: {
        Row: AssetEmbedding
        Insert: Partial<AssetEmbedding> & { asset_id: string; model: string; embedding: number[] }
        Update: Partial<AssetEmbedding>
        Relationships: []
      }
      beta_invites: {
        Row: BetaInvite
        Insert: Partial<BetaInvite> & { email: string }
        Update: Partial<BetaInvite>
        Relationships: []
      }
      plans: {
        Row: Plan
        Insert: Partial<Plan> & { code: string; name: string }
        Update: Partial<Plan>
        Relationships: []
      }
      plan_quotas: {
        Row: PlanQuota
        Insert: Partial<PlanQuota> & { plan_id: string; quota_key: string; quota_limit: number }
        Update: Partial<PlanQuota>
        Relationships: []
      }
      user_plan_assignments: {
        Row: UserPlanAssignment
        Insert: Partial<UserPlanAssignment> & { user_id: string; plan_id: string }
        Update: Partial<UserPlanAssignment>
        Relationships: []
      }
      quota_usage: {
        Row: QuotaUsage
        Insert: Partial<QuotaUsage> & { user_id: string; quota_key: string }
        Update: Partial<QuotaUsage>
        Relationships: []
      }
      billing_customers: {
        Row: BillingCustomer
        Insert: Partial<BillingCustomer> & { user_id: string; provider: string; provider_customer_id: string }
        Update: Partial<BillingCustomer>
        Relationships: []
      }
      subscriptions: {
        Row: Subscription
        Insert: Partial<Subscription> & {
          user_id: string
          plan_id: string
          provider: string
          provider_subscription_id: string
          status: SubscriptionStatus
        }
        Update: Partial<Subscription>
        Relationships: []
      }
      subscription_events: {
        Row: SubscriptionEvent
        Insert: Partial<SubscriptionEvent> & { provider: string; provider_event_id: string; event_type: string }
        Update: Partial<SubscriptionEvent>
        Relationships: []
      }
      pesapal_checkout_orders: {
        Row: PesapalCheckoutOrder
        Insert: Partial<PesapalCheckoutOrder> & { user_id: string; merchant_reference: string; plan_code: string; amount_cents: number; currency: string }
        Update: Partial<PesapalCheckoutOrder>
        Relationships: []
      }
      plan_ai_providers: {
        Row: PlanAiProvider
        Insert: Partial<PlanAiProvider> & { plan_id: string; provider_id: string }
        Update: Partial<PlanAiProvider>
        Relationships: []
      }
      user_quota_overrides: {
        Row: UserQuotaOverride
        Insert: Partial<UserQuotaOverride> & { user_id: string; quota_key: string; quota_limit: number }
        Update: Partial<UserQuotaOverride>
        Relationships: []
      }
      platform_admins: {
        Row: PlatformAdmin
        Insert: Partial<PlatformAdmin> & { user_id: string }
        Update: Partial<PlatformAdmin>
        Relationships: []
      }
      platform_provider_settings: {
        Row: PlatformProviderSetting
        Insert: Partial<PlatformProviderSetting> & { provider_id: string }
        Update: Partial<PlatformProviderSetting>
        Relationships: []
      }
      founding_pro_applications: {
        Row: FoundingProApplication
        Insert: Partial<FoundingProApplication> & { user_id: string }
        Update: Partial<FoundingProApplication>
        Relationships: []
      }
      founding_pro_members: {
        Row: FoundingProMember
        Insert: Partial<FoundingProMember> & { user_id: string; slot_type: FoundingProMemberSlotType; founding_price_cents: number; founding_expires_at: string }
        Update: Partial<FoundingProMember>
        Relationships: []
      }
      founding_pro_capacity: {
        Row: FoundingProCapacity
        Insert: Partial<FoundingProCapacity>
        Update: Partial<FoundingProCapacity>
        Relationships: []
      }
      founding_pro_events: {
        Row: FoundingProEvent
        Insert: Partial<FoundingProEvent> & { event_type: FoundingProEventType }
        Update: Partial<FoundingProEvent>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      match_document_chunks: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter_user_id?: string
          filter_document_id?: string | null
          filter_workspace_id?: string | null
        }
        Returns: { chunk_id: string; document_id: string; content: string; similarity: number }[]
      }
      match_messages: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter_user_id?: string
          filter_workspace_id?: string | null
        }
        Returns: { message_id: string; conversation_id: string; content: string; similarity: number }[]
      }
      match_notes: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter_user_id?: string
          filter_workspace_id?: string | null
        }
        Returns: { note_id: string; title: string; content: string; similarity: number }[]
      }
      match_assets: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter_user_id?: string
          filter_workspace_id?: string | null
        }
        Returns: { asset_id: string; title: string; similarity: number }[]
      }
      invite_to_workspace: {
        Args: {
          target_workspace_id: string
          invitee_email: string
          invitee_role: WorkspaceMemberRole
        }
        /**
         * UX-14.5.8 Phase 1 — no longer always a `WorkspaceMember` row: an
         * unknown email has none to return (see `WorkspaceInvitation`), so
         * this is a small outcome descriptor instead. `membership_id`/
         * `invitation_id` are set on whichever branch actually ran.
         */
        Returns: { outcome: 'member_invited'; membership_id: string } | { outcome: 'invitation_created'; invitation_id: string }
      }
      respond_to_workspace_invitation: {
        Args: {
          target_membership_id: string
          accept: boolean
        }
        Returns: WorkspaceMember
      }
      list_workspace_members: {
        Args: {
          target_workspace_id: string
        }
        Returns: WorkspaceMemberWithProfile[]
      }
      is_beta_invited: {
        Args: { check_email: string }
        Returns: boolean
      }
      consume_quota: {
        Args: { p_quota_key: string }
        Returns: { usage_count: number; quota_limit: number; allowed: boolean }[]
      }
      is_platform_admin: {
        Args: { uid?: string }
        Returns: boolean
      }
      admin_list_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          display_name: string | null
          created_at: string
          last_sign_in_at: string | null
          plan_code: string | null
          plan_name: string | null
          plan_quota_limit: number | null
          quota_override: number | null
          effective_quota_limit: number | null
          quota_used: number | null
          beta_status: string | null
          is_disabled: boolean
        }[]
      }
      resolve_effective_quota_limit: {
        Args: { p_user_id: string; p_quota_key: string }
        Returns: number | null
      }
      admin_set_user_quota_override: {
        Args: { p_user_id: string; p_quota_key: string; p_quota_limit: number }
        Returns: void
      }
      admin_remove_user_quota_override: {
        Args: { p_user_id: string; p_quota_key: string }
        Returns: void
      }
      admin_list_beta_invites: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          status: string
          full_name: string | null
          organization: string | null
          invited_by: string | null
          created_at: string
          accepted_at: string | null
          accepted_by: string | null
          accepted_by_email: string | null
          plan_id: string | null
          plan_code: string | null
        }[]
      }
      admin_create_beta_invite: {
        Args: { p_email: string; p_full_name?: string | null; p_organization?: string | null; p_plan_id?: string | null }
        Returns: { outcome: 'created' | 'duplicate'; invite_id: string | null }[]
      }
      admin_revoke_beta_invite: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      admin_change_user_plan: {
        Args: { p_user_id: string; p_plan_id: string }
        Returns: void
      }
      admin_reset_user_quota: {
        Args: { p_user_id: string; p_quota_key: string }
        Returns: void
      }
      admin_set_user_disabled: {
        Args: { p_user_id: string; p_disabled: boolean }
        Returns: void
      }
      admin_set_platform_provider_setting: {
        Args: { p_provider_id: string; p_enabled: boolean; p_priority: number }
        Returns: void
      }
      admin_ai_usage_summary: {
        Args: { p_since?: string }
        Returns: { provider: string; request_count: number; error_count: number; avg_latency_ms: number }[]
      }
      admin_platform_counts: {
        Args: Record<string, never>
        Returns: { documents: number; conversations: number; notes: number; knowledge_collections: number }[]
      }
      admin_update_plan_quota: {
        Args: { p_plan_id: string; p_quota_key: string; p_quota_limit: number }
        Returns: void
      }
      admin_set_plan_ai_provider: {
        Args: { p_plan_id: string; p_provider_id: string; p_active: boolean; p_priority: number }
        Returns: void
      }
      admin_update_plan_commercial: {
        Args: {
          p_plan_id: string
          p_monthly_price_cents: number | null
          p_annual_price_cents: number | null
          p_currency: string
          p_active: boolean
        }
        Returns: void
      }
      /**
       * Founding Pro Programme Phase 1 — public-safe capacity read. Never
       * exposes identity or price, only the aggregate counter.
       */
      get_founding_pro_public_capacity: {
        Args: Record<string, never>
        Returns: { max_public_slots: number; enrolled_public_count: number; remaining_public_slots: number }[]
      }
      /**
       * Founding Pro Programme Phase 1 — the single atomic, admin-authorized
       * enrollment RPC (admin check -> verify approved application -> lock
       * capacity -> verify <100 -> allocate number -> create member row ->
       * assign founding_pro plan -> mark application enrolled -> audit
       * event, all in one transaction). `p_founding_price_cents`/
       * `p_currency` are never defaulted or derived from
       * `plans.monthly_price_cents` — the caller must always supply them.
       */
      admin_enroll_founding_pro_member: {
        Args: {
          p_application_id: string
          p_slot_type: FoundingProMemberSlotType
          p_founding_price_cents: number
          p_currency: string
        }
        Returns: Record<string, unknown>
      }
      has_feature: {
        Args: { p_user_id: string; p_feature_key: string }
        Returns: boolean
      }
      calculate_user_storage_usage: {
        Args: { p_user_id: string }
        Returns: number
      }
      /**
       * Phase 4 — `apply_subscription_event` is intentionally NOT typed
       * here: it's granted to `service_role` only (never `anon`/
       * `authenticated`), so no client code has a legitimate call site for
       * it, and typing it would invite exactly the kind of client-side
       * `supabase.rpc('apply_subscription_event', ...)` call this
       * function's grants are designed to make impossible. It's called
       * exclusively from the billing webhook Edge Function using the
       * service-role client.
       */
      admin_get_user_subscription: {
        Args: { p_user_id: string }
        Returns: {
          provider: string
          provider_subscription_id: string
          plan_code: string
          status: SubscriptionStatus
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          updated_at: string
        }[]
      }
    }
    Enums: {
      document_file_type: DocumentFileType
      document_status: DocumentStatus
      processing_status: ProcessingStatus
      message_role: MessageRole
      ai_request_status: AiRequestStatus
      ai_memory_type: AiMemoryType
      workspace_objective_status: WorkspaceObjectiveStatus
      workspace_invitation_status: WorkspaceInvitationStatus
    }
  }
}
