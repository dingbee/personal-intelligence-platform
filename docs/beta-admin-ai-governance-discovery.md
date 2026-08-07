# Beta / Admin / AI Governance Foundation — Discovery Report

Read-only audit performed before any implementation, per this phase's own instructions. The live Supabase database (project `uzshazetfkjkrdnxwjtl`) was inspected directly — nothing here is inferred from migration files alone, since several tables were confirmed (in the prior Beta Invite + Quota reconciliation pass, `docs/beta-invite-quota-reconciliation.md`) to have been created manually and untracked.

## 1. Current architecture

NOVA PIP is a React 19 + TypeScript SPA over Supabase (Postgres + Auth + Storage + 3 Edge Functions), with a `src/modules/*` feature-module layout. Two things matter most for this phase:

- **A `providerRegistry`/`chatProviders` split already exists and is architecturally sound** (see §6) — provider execution, routing, and fallback are already centralized in `AIService`/`resolveProviderChain`/`runWithFallback`, not scattered. The work this phase needs is *entitlement and visibility* on top of an already-correct execution layer, not a rebuild.
- **No platform-level authorization primitive exists at all.** The only role concept anywhere in the schema is workspace-scoped (`workspace_member_role`, `has_workspace_role()`) — explicitly out of scope, a different concern (who can edit a shared note vs. who operates the platform).

## 2. Beta Invite state

Unchanged since the prior reconciliation pass (`docs/beta-invite-quota-reconciliation.md`), re-verified live just now: `beta_invites` has 1 row (`dan@nolmark.co`, `status: 'accepted'`, `accepted_at`/`accepted_by` set), the `status` default is the fixed clean value, `is_beta_invited()`/`assign_default_plan()` are correct, RLS is enabled with zero client policies (locked down — only the two `SECURITY DEFINER` functions touch it), and the `enforce_beta_invite_gate` `BEFORE INSERT` trigger on `auth.users` is in place as the server-side backstop. **No changes needed here** beyond what admin tooling requires to read/write it (see §7).

## 3. Signup state

Unchanged: `AuthContext.signUpWithPassword` → `is_beta_invited()` RPC → `auth.signUp()`, backstopped server-side by `enforce_beta_invite_gate`. Confirmed sound in the prior pass.

## 4. Plan state

`plans` (free/beta/pro/enterprise), `user_plan_assignments` — unchanged, confirmed sound (`UNIQUE(user_id, active)` prevents duplicate active assignments; `assign_default_plan()` correctly resolves invite-attached plan → `beta` fallback). **New for this phase**: nothing yet resolves a user's plan *code* (not just id) for entitlement decisions (e.g. "is this user Pro+") — `quotaService.ts` only ever needed `plan_id` to join into `plan_quotas`. A small addition is needed (§10).

## 5. Quota state

Unchanged, confirmed sound: `consume_quota()` RPC (atomic, period-scoped), RLS enabled with own-row-only `SELECT`, no client write policies.

## 6. AI provider state

Full trace (background-agent audit, file-and-line grounded):

- **Two registries, correctly separated**: `providerRegistry` (`src/modules/core/providers/registry.ts`, metadata: id/label/kind/status/models) vs. the runtime `chatProviders` map (`src/modules/ai/providers/registry.ts`, id → `ChatProvider` implementation). A code comment already states the intended discipline: *"AIService is the only thing that should read from this map; UI code asks AIService, not this registry, for a provider."*
- **Execution path**: `ChatPage`/`ReaderChatPanel` → `useSendMessage` → `AIService.sendMessage` → `runWithFallback(chain, streamChatCompletion)` → `provider.chat()` → `streamAiChat()` (raw `fetch`, for real streaming) → `supabase/functions/ai-chat` (Deno) → the actual Anthropic/OpenAI/Google HTTP call.
- **Routing**: `resolveProviderChain()` (deterministic, pure — preferred provider first if eligible, else health-score-sorted remainder) + `runWithFallback()` (sequential try-in-order, single hop per candidate). Every resolved chain and any fallback that occurred is logged into `ai_requests` (`requested_provider`/`fallback_reason`) — already auditable, not opaque.
- **Security check (explicitly required by this phase): no leak found.** Grepped all of `src/**` for API-key/secret patterns — every hit is either an error-message string match (categorizing a "key not configured" response) or a doc comment naming an env var by name. The one real secret-shaped value client-side is `VITE_SUPABASE_ANON_KEY`, which is the Supabase publishable key — meant to be public. The three real provider keys (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GOOGLE_API_KEY`) are read exclusively inside `supabase/functions/ai-chat/index.ts` and `supabase/functions/provider-availability/index.ts` via `Deno.env.get`, and that file's own header comment codifies this as an explicit rule ("the ONLY place provider API keys are read"). **This boundary is intact and must be preserved exactly as-is.**
- **Provider identity is currently fully exposed to every signed-in user, everywhere, with zero gating**: `ProviderSelect` (dropdown, in `ChatPage`'s new-conversation picker and in-conversation header, and in `ReaderChatPanel`), `ProviderStatusCard` (the full "Provider Control Center" in Settings — enable/disable toggle per provider, a live "run test" button, health scores, models — writable by any user for their own account via `provider_overrides`), `AiHealthPage`/`ProviderHealthDetailPage`, and `SettingsPage`'s "Recent AI activity" table (raw `provider`/`model` strings per row). This is exactly the "current problem" this phase is meant to fix — see §10.
- **`provider_overrides`**: per-user, `RLS: auth.uid() = user_id` for all operations. No platform-wide override concept exists — "disable Anthropic for everyone" is not a capability the database currently supports; building it would be new schema, not a gap in an existing intent. Scoped out of this phase's build (see §12) — the Admin Dashboard's "AI Providers" section is read-only visibility for v1, not platform-wide write control, to respect "refactor only as much as necessary."

## 7. Admin/authentication state

**No platform-level admin/founder concept exists anywhere** — no table, no column, no function, no route guard beyond the single generic `ProtectedRoute` (session-presence only). One stub exists: `/admin/beta` route → `BetaInvitesPage`, a 9-line placeholder ("Admin beta dashboard coming soon") with zero authorization logic of its own — any signed-in user can currently open it (it just renders nothing sensitive today).

The one clean, reusable **pattern** in this codebase for exactly this shape of problem is `has_workspace_role()` (SQL, `SECURITY DEFINER stable`, used inside RLS policies) mirrored by `resolveWorkspaceRole()` (TypeScript, same resolution logic) — the migration's own comment states the discipline explicitly: *"a permission decision never differs between what the UI shows and what the database actually enforces."* This is the shape the new platform-admin primitive should take.

**Important constraint discovered**: `profiles` already has a self-service RLS `UPDATE` policy (`auth.uid() = id`). Adding an `is_admin` boolean column directly to `profiles` would let any user grant themselves admin by editing their own profile — a direct violation of "founder privileges cannot be self-assigned." This is why the new primitive must live in a **separate table with no client write policies at all** (§10), not a `profiles` column.

## 8. Database vs. repository discrepancies

Same finding as the prior reconciliation pass, still true: `beta_invites`/`plans`/`plan_quotas`/`user_plan_assignments`/`quota_usage` and their functions exist live but were created outside migration tracking; `0034_beta_invite_quota_repair.sql` was the first migration to touch any of them. No further drift found for this phase's scope — `providerRegistry`/`chatProviders`/`provider_overrides`/Edge Functions are all properly tracked in migrations and match the live schema.

## 9. Security findings

1. **(Critical, already fixed in the prior pass, re-confirmed still fixed)** RLS on `plans`/`plan_quotas`/`user_plan_assignments`/`quota_usage` — enabled, own-row-only.
2. **(New, this phase)** No admin authorization exists, so nothing currently *could* violate it — but any new admin surface must be built with the `profiles`-self-update lesson in mind (§7): a separate table, zero client write policies, and a `SECURITY DEFINER` boolean-check function, exactly mirroring `has_workspace_role()`.
3. **(New, this phase)** `ProviderStatusCard`'s "run test" button fires a real, live API call against the shared platform API key, available to every signed-in user today with no rate limit beyond normal quota. Not a secret leak, but a cost/abuse surface worth closing off to admin-only as part of this phase's re-gating (§10) rather than leaving it as a footgun.
4. Provider API keys: **no leak found** (§6) — this is a finding to preserve, not a defect to fix.

## 10. Recommended architecture

**Platform admin primitive** (new): a `platform_admins(user_id uuid primary key, granted_at, granted_by)` table — deliberately *not* a `profiles` column (§7). RLS enabled; the only client policy is `SELECT` where `auth.uid() = user_id` (a user can check whether *they* are an admin; the full admin list isn't exposed to arbitrary clients). No `INSERT`/`UPDATE`/`DELETE` policy for any client role at all — granting admin status is a manual, explicit, out-of-band action (a migration statement or direct SQL), never a client-reachable mutation, satisfying "founder privileges cannot be self-assigned" literally. A `SECURITY DEFINER stable` function `is_platform_admin(uid uuid default auth.uid()) returns boolean`, mirroring `has_workspace_role()`'s shape exactly, is what both the client (`usePlatformAdmin()` hook) and future RLS/RPC gating check.

**Plan resolution** (new): a small `src/modules/plans/` module — `getCurrentUserPlan()` (joins `user_plan_assignments` → `plans`, returns `{planId, planCode, planName}`), a `useCurrentPlan()` hook, and pure entitlement functions (`canSelectProvider(planCode)` → `pro`/`enterprise` only). This is the one piece of new "read my own plan code" surface `quotaService.ts` never needed.

**Admin RPCs** (new, all `SECURITY DEFINER`, all internally re-check `is_platform_admin()` and raise if not — server-enforced, not merely UI-hidden, per this phase's central principle): `admin_list_users()` (joins `profiles` + `user_plan_assignments` + `plans` + `quota_usage`, since `profiles`' own RLS is self-only and would otherwise block a cross-user read — same bridging pattern `list_workspace_members()` already uses in this codebase), `admin_list_beta_invites()`, `admin_create_beta_invite(email, full_name, organization, plan_id)` (normalizes email lowercase, relies on the existing `UNIQUE(lower(email))` constraint for duplicate detection, returns a typed outcome rather than a raw constraint-violation error), `admin_revoke_beta_invite(invite_id)` (deletes only rows still `status = 'invited'` — never touches an already-accepted row, preserving history).

**Provider visibility**: chat UI (`ChatPage`, `ReaderChatPanel`) becomes provider-neutral for every plan — remove `ProviderSelect` and the provider-naming warning banner entirely from both. A new gated "Advanced Settings" section (Pro/Enterprise/Founder only) hosts a single "AI Provider" picker (reusing `ProviderSelect`, which already filters to configured+available only) wired to the existing `profiles.default_chat_provider_id`. `ProviderStatusCard` (the rich control-center: test/enable-disable/health) and the `AiHealthPage`/`ProviderHealthDetailPage` routes move from "every signed-in user" to admin-only, surfaced inside the new `/admin` dashboard's "AI Providers" section instead of linked from ordinary Settings.

## 11. Implementation order

1. Migration: `platform_admins` + `is_platform_admin()` + the four admin RPCs above — additive, no data touched, bootstraps the one known operator account (`dan@nolmark.co`) as founder via an explicit `insert` statement (flagged, not silent).
2. `src/modules/admin/` — `usePlatformAdmin()`, `RequireAdmin` route guard, `AdminDashboardPage` with the six sections, wired into the router replacing the `/admin/beta` stub.
3. `src/modules/plans/` — plan-code resolution + entitlement helpers.
4. Provider visibility changes: `ChatPage`/`ReaderChatPanel` (remove), `SettingsPage` (gate/relocate), new gated Advanced Settings surface.
5. Tests, manual checklist, verification gate, docs, commit.

## 12. Explicit items that must NOT be changed

- `beta_invites`/`is_beta_invited`/`assign_default_plan`/`enforce_beta_invite_gate` — already correct, not touched beyond adding the admin RPCs that read/write them.
- `plans`/`plan_quotas`/`user_plan_assignments`/`quota_usage`/`consume_quota` — already correct, not touched.
- `AIService`/`resolveProviderChain`/`runWithFallback`/`streamChatCompletion`/`ai-chat` Edge Function — the execution/routing layer is already sound; this phase only changes who can *see* it, not how it works.
- `provider_overrides` — left as a per-user, self-scoped capability; no platform-wide override table is built this phase (would be new schema beyond "refactor only as much as necessary").
- Knowledge Exchange package architecture, export/import systems, Knowledge Graph, workspace collaboration — untouched, out of scope.
- No UX-15.3.x/UX-15.4 work resumed.
