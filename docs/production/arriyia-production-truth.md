# ARRIYIA PIP — Production Truth Matrix

The single authoritative answer to: what exists in code, what is committed, what is pushed, what database state is required vs. actually present, what is verified, what remains intentionally unresolved, and what was merely deployment drift misdiagnosed as a product defect.

This document is new (Stabilization & Reconciliation workstream, this session). It doesn't replace `docs/arriyia-personal-release-backlog.md` or `docs/feature-matrix.md` — those remain the historical record for the "ARRIYIA Personal v1" release milestone they were written for, and are left untouched below that scope. This doc picks up where they leave off: the Professional Intelligence tier (Data/Analysis/Research/Planning/Decision/Action Intelligence, Execution Foundation, Intelligence Ledger, History) that shipped after that milestone closed, and the deployment-drift incident this reconciliation resolved. See the cross-reference note added to the top of `docs/feature-matrix.md`.

**Update discipline going forward:** update this file's tables when a capability's commit/push/migration/verification state changes. Don't create a second competing production-status document — extend this one.

---

## 1. Release Identity

| Field | Value |
|---|---|
| Application | ARRIYIA PIP (`dingbee/personal-intelligence-platform`) |
| Current branch | `main` |
| Current commit | `d4dd19716d6bba9f2a0ecd8c11b90edbbae3643d` |
| `origin/main` | `d4dd197` — confirmed identical to current commit via `git fetch` + `git rev-list --count`, this session |
| Production commit (Vercel) | `d4dd197` — **user-reported, not independently verified**: no Vercel CLI/API access exists in this environment |
| Vercel deployment status | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| Deployment timestamp | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| Database environment | Supabase project `uzshazetfkjkrdnxwjtl` |
| Migration state | Repo has 66 migration files (`0001`–`0066`). `0065`/`0066` confirmed applied live earlier this session (direct SQL Editor verification). `0056`–`0064` reported applied by the user; **not independently re-confirmed this session** — `mcp__Supabase__execute_sql` returns `-32003: MCP tool call requires approval` on every call attempted, read or write, throughout this entire engagement |
| Verification timestamp | This session (see individual sections for what was actually run vs. reported) |
| Overall release status | **YELLOW** — Git layer fully verified and clean; database/Vercel layer accepted on the user's own report, not independently confirmed |

---

## 2. Repository Truth

| Capability | Implementation | Frontend | Backend | Migration | Tests | Commit | Pushed | Status |
|---|---|---|---|---|---|---|---|---|
| Hub | ✅ | `WorkspaceIntelligenceHubPage` | RLS-scoped queries | `0021` + several since | ✅ | ✅ (`main`, pre-dates this session) | ✅ | Aligned |
| Collaboration | ✅ | `WorkspaceMemberRoster`, `WorkspaceCollaborationPage` | `invite_to_workspace` RPC + RLS | `0028`–`0033` | ✅ | ✅ | ✅ | Aligned |
| Library | ✅ | `LibraryPage`, `DocumentDetailPage` | RLS-scoped queries | `0002` + several since | ✅ | ✅ | ✅ | Aligned |
| Knowledge | ✅ | `KnowledgePage`, graph/explorer/collections | RLS + extraction pipeline | `0010`–`0016`, `0026` | ✅ | ✅ | ✅ | Aligned |
| Notes | ✅ | `NotesPage`, `NoteDetailPage` | RLS-scoped queries | part of `0002` family | ✅ | ✅ | ✅ | Aligned |
| Search | ✅ | `SearchPage`, multi-provider ranking | RLS-scoped queries | `0007`, `0025`, `0039` | ✅ | ✅ | ✅ | Aligned |
| Chat | ✅ | `ChatPage` | `ai-chat` Edge Function, `ai_requests` | `0005`, `0006`, `0015` | ✅ | ✅ | ✅ | Aligned |
| Data Intelligence | ✅ | `DataIntelligenceQueryPanel` | `runDataIntelligenceQuery`, `has_feature` gate | `0057`, `0058`, `0061` | ✅ | ✅ (`8dbdf44` etc.) | ✅ | **Was E — Entitlement Drift, reported resolved** |
| Analysis Intelligence | ✅ | `AnalysisInvestigationPanel` | `runAnalysisInvestigation`, `has_feature` gate | `0059`, `0061` | ✅ | ✅ (`9bab3e7`) | ✅ | Same as above |
| Research Intelligence | ✅ | `ResearchPage` (`/research`) | `runResearchInvestigation`, `has_feature` gate | `0060`, `0061` | ✅ | ✅ (`9fc73e8`) | ✅ | Same as above — this was the originally reported symptom |
| Planning Intelligence | ✅ | `PlanningPage` (`/planning`) | `runPlanningIntelligence`, `has_feature` gate | `0062` | ✅ | ✅ (`61f6367`) | ✅ (this session) | Same as above |
| Decision Intelligence | ✅ | `DecisionPage` (`/decisions`) | `runDecisionIntelligence`, `has_feature` gate | `0063` | ✅ | ✅ (`545b0ec`) | ✅ (this session) | Same as above |
| Action Intelligence | ✅ | `ActionsPage` (`/actions`) | `runActionIntelligence`, `has_feature` gate | `0064` | ✅ | ✅ (`e07a727`) | ✅ (this session) | Same as above |
| Execution Foundation | ✅ | `ExecutionsPage` (`/executions`) | 6 SECURITY DEFINER RPCs, state machine | `0065` | ✅ | ✅ (`5af3ec3`) | ✅ (this session) | **B — Deployment Drift, resolved this session** |
| Intelligence Ledger | ✅ (backend) | (feeds History, no dedicated page) | 2 SECURITY DEFINER RPCs, 7-engine writers | `0066` | ✅ | ✅ (`b0b547d`) | ✅ (this session) | **B — Deployment Drift, resolved this session** |
| History | ✅ | `HistoryPage` + 2 detail pages (`/history`) | reads Ledger tables via RLS | (no dedicated migration — reads `0066`'s tables) | — (UI only, no new pure logic) | ✅ (`51536e5`) | ✅ (this session) | **B — Deployment Drift, resolved this session** |
| Export Center | ✅ | `ExportCenterPage` | client-side generation | n/a | ✅ | ✅ | ✅ | Aligned |
| Settings | ✅ | `SettingsPage` + sub-pages | RLS-scoped, admin-gated sub-pages | several | ✅ | ✅ | ✅ | Aligned |
| Pricing | ✅ | `PricingPage` (public route) | `getPublicPlanCatalog` | `0044`–`0051` | ✅ | ✅ | ✅ | Aligned |
| Admin | ✅ | `AdminDashboardPage` + sub-pages | admin-only RPCs, `is_platform_admin()` | several | ✅ | ✅ | ✅ | Aligned |
| Entitlement system | ✅ | `useHasFeature` + 7 capability-specific hooks | `has_feature`/`resolve_effective_quota_limit` RPCs | `0041`, `0046`, `0056`–`0064` | ✅ (+ hardened this session) | ✅ | ✅ | Aligned (code); DB rows reported applied, unverified by me |
| Quota system | ✅ | `quotaService.ts` | `consume_quota`, `resolve_effective_quota_limit` | `0034`, `0041` | ✅ | ✅ | ✅ | Aligned |
| Operation budgets | ✅ | `intelligenceOperations.ts` | `plan_quotas` `*_operations` keys, `ai_requests.operation_id/type` | `0061` | ✅ | ✅ | ✅ | Same drift/resolution as above |
| Provenance | ✅ | `RecordProvenanceView` (History), per-engine adapters | `src/shared/provenance/**` | n/a (application-layer only) | ✅ | ✅ | ✅ | Aligned |
| Evidence | ✅ | rendered inline in Ledger/History records | `resolveEvidenceChain.ts` | n/a | ✅ | ✅ | ✅ | Aligned |
| Workspace system | ✅ | `WorkspaceSwitcher`, workspace-scoped queries throughout | `workspaces`, `workspace_members`, `has_workspace_role()` | `0004`, `0028`–`0033` | ✅ | ✅ | ✅ | Aligned |
| AI provider infrastructure | ✅ | admin-only provider control center | `runWithFallback`, provider chain, `plan_ai_providers` | `0013`–`0015`, `0049` | ✅ | ✅ | ✅ | Aligned |
| Edge Functions | ✅ (9 functions, see §6) | n/a | see §6 | n/a | partial | ✅ | **UNVERIFIED — LIVE ACCESS REQUIRED for deployed state** | See §6 |

---

## 3. Production Database Truth

| Migration | Exists in repo | Required objects | Production applied | Object verified | Status |
|---|---|---|---|---|---|
| `0045_founding_pro_plan.sql` | ✅ | `founding_pro` plan row | ✅ (confirmed live, `plan_quotas` dump this session) | ✅ | Aligned |
| `0046_feature_entitlements_and_storage_quota.sql` | ✅ | `feature:collaboration`, `ai_messages`, `storage_bytes` rows | ✅ (confirmed live) | ✅ | Aligned |
| `0056_pro_intelligence_foundation.sql` | ✅ | `feature:pro_intelligence` (pro/founding_pro) | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0057_structured_datasets.sql` | ✅ | `structured_datasets` table + RLS + trigger + 3 indexes | ✅ *(user-reported: "present")* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0058_data_intelligence_entitlement.sql` | ✅ | `feature:data_intelligence` | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0059_analysis_intelligence_entitlement.sql` | ✅ | `feature:analysis_intelligence` | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0060_research_intelligence_entitlement.sql` | ✅ | `feature:research_intelligence` | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0061_intelligence_operation_budgets.sql` | ✅ | 3 `*_operations` rows, `ai_requests.operation_id/type` + index | ✅ *(user-reported: columns present)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0062_planning_intelligence_entitlement.sql` | ✅ | `feature:planning_intelligence` + operations quota | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0063_decision_intelligence_entitlement.sql` | ✅ | `feature:decision_intelligence` + operations quota | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0064_action_intelligence_entitlement.sql` | ✅ | `feature:action_intelligence` + operations quota | ✅ *(user-reported)* | **UNVERIFIED — LIVE ACCESS REQUIRED** | Aligned per report, unconfirmed by me |
| `0065_execution_foundation.sql` | ✅ | 4 tables, 6 RPCs, RLS, indexes | ✅ (confirmed live this session, direct SQL Editor verification) | ✅ | Aligned |
| `0066_intelligence_ledger.sql` | ✅ | 2 tables, 2 RPCs, RLS, indexes | ✅ (confirmed live this session) | ✅ | Aligned |

No migration in this range was found present-in-repo-but-unapplied, partially applied, or has since had its intended schema/data superseded by a later migration. `0057` is the one non-idempotent statement in this range (`CREATE TABLE` without `IF NOT EXISTS`) — flagged to the user before application; user reports it's now present.

---

## 4. Entitlement Truth

Every `feature:*` row below shares the exact same resolution path: `useHasFeature(key)` → `hasFeature()` → `has_feature` RPC → `resolve_effective_quota_limit` → `user_plan_assignments` → `plan_quotas`. No capability in this table has a second, parallel entitlement mechanism.

| Feature key | Free | Beta | Pro | Founding Pro | Enterprise | Quota/operation budget | Frontend gate | Backend enforcement | Migration | Production |
|---|---|---|---|---|---|---|---|---|---|---|
| `feature:collaboration` | ❌ (no row) | ❌ | ✅ (1) | ✅ (1) | not implemented | n/a | `useHasFeature('collaboration')` | `invite_to_workspace` re-checks server-side | `0046` | ✅ confirmed live |
| `feature:pro_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | n/a | `useHasProIntelligence` (gates Workspace Briefing) | `has_feature` re-checked wherever consumed | `0056` | reported applied, unverified |
| `feature:data_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | `data_intelligence_operations` = 1000/mo | `useHasDataIntelligence` | `has_feature` inside `runDataIntelligenceQuery` | `0058` | reported applied, unverified |
| `feature:analysis_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | `analysis_intelligence_operations` = 1000/mo | `useHasAnalysisIntelligence` | `has_feature` inside `runAnalysisInvestigation` | `0059` | reported applied, unverified |
| `feature:research_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | `research_intelligence_operations` = 1000/mo | `useHasResearchIntelligence` | `has_feature` inside `runResearchInvestigation` | `0060` | reported applied, unverified |
| `feature:planning_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | `planning_intelligence_operations` = 1000/mo | `useHasPlanningIntelligence` | `has_feature` inside `runPlanningIntelligence` | `0062` | reported applied, unverified |
| `feature:decision_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | `decision_intelligence_operations` = 1000/mo | `useHasDecisionIntelligence` | `has_feature` inside `runDecisionIntelligence` | `0063` | reported applied, unverified |
| `feature:action_intelligence` | ❌ | ❌ | ✅ (1) | ✅ (1) | not implemented | `action_intelligence_operations` = 1000/mo | `useHasActionIntelligence` | `has_feature` inside `runActionIntelligence` | `0064` | reported applied, unverified |
| `ai_messages` | (own row) | (own row) | 10000/mo | 1000/mo | not implemented | n/a (base quota, not a feature flag) | n/a | `consume_quota`/`resolve_effective_quota_limit` | `0034`, `0046` | ✅ confirmed live |
| `storage_bytes` | (own row) | (own row) | 5368709120 | 5368709120 | not implemented | n/a | `getStorageUsage` | `resolve_effective_quota_limit` | `0046` | ✅ confirmed live |

No Enterprise plan row exists yet (`0056`'s own comment: "Extending Pro Intelligence to a future Business plan is a one-line insert here... when that phase is scoped" — never scoped). Execution Foundation, Intelligence Ledger, and History have **no entitlement key, by final product decision** — see §9's `DECIDED — FREE / INCLUDED` disposition. This is deliberate, not a gap: no migration or entitlement key will be added for these three surfaces.

---

## 5. Route / Navigation Truth

| Surface | Route | Sidebar | Router | Implementation | Production (per user report) |
|---|---|---|---|---|---|
| Hub | `/hub` | ✅ top-level | ✅ | ✅ | ✅ |
| Collaboration | `/collaboration` | ✅ top-level | ✅ | ✅ | ✅ |
| Library | `/library` | ✅ top-level | ✅ | ✅ | ✅ |
| Library detail | `/library/:documentId` | intentional detail route (card click, not nav) | ✅ | ✅ | ✅ |
| Reader | `/library/:documentId/read` | intentional detail route | ✅ | ✅ | ✅ |
| Asset reader | `/library/assets/:assetId` | intentional detail route | ✅ | ✅ | ✅ |
| Knowledge | `/knowledge`, `/knowledge/export` | ✅ top-level (both) | ✅ | ✅ | ✅ |
| Knowledge sub-pages | `/knowledge/graph`, `/knowledge/explorer`, `/knowledge/nodes/:id`, `/knowledge/collections`(+`:id`) | intentional detail routes (in-page links from Knowledge dashboard) | ✅ | ✅ | ✅ |
| Notes | `/notes` | ✅ top-level | ✅ | ✅ | ✅ |
| Notes detail | `/notes/:noteId` | intentional detail route | ✅ | ✅ | ✅ |
| Search | `/search` | ✅ top-level | ✅ | ✅ | ✅ |
| Research | `/research` | ✅ top-level | ✅ | ✅ | reported ✅ (gate fixed) |
| Planning | `/planning` | ✅ top-level | ✅ | ✅ | ✅ (this session's push) |
| Decision | `/decisions` | ✅ top-level | ✅ | ✅ | ✅ |
| Action | `/actions` | ✅ top-level | ✅ | ✅ | ✅ |
| Execution Foundation | `/executions` | ✅ top-level | ✅ | ✅ | ✅ |
| History | `/history`, `/history/records/:recordId`, `/history/journeys/:journeyId` | ✅ top-level (`/history`); detail routes intentional (record/journey click) | ✅ | ✅ | ✅ |
| Chat | `/chat` | ✅ top-level | ✅ | ✅ | ✅ |
| Dashboard | `/dashboard` | **intentionally hidden** — folded into Hub's "Explore Deeper" per `Sidebar.tsx`'s own UX-15.2 comment | ✅ | ✅ | ✅ |
| Evolution | `/evolution` | **intentionally hidden**, same reason | ✅ | ✅ | ✅ |
| Settings | `/settings` (+6 sub-routes) | ✅ top-level only; sub-routes intentional detail routes | ✅ | ✅ | ✅ |
| Pricing | `/pricing` | ✅ top-level, deliberately outside `ProtectedRoute` (must load logged-out) | ✅ | ✅ | ✅ |
| Admin | `/admin`(+4 sub-routes) | ✅ conditional on `isAdmin` | ✅ | ✅ | ✅ |
| `admin/beta` | redirect → `/admin` | n/a | ✅ | ✅ (deprecated route kept as redirect) | ✅ |
| Auth | `/login`, `/signup`, `/forgot-password`, `/reset-password` | n/a (pre-auth) | ✅ | ✅ | ✅ |
| Billing/Founding Pro | `/billing/return`, `/founding-pro/apply`, `/founding-pro/invitation` | intentional — reached via payment redirect / email links, not nav | ✅ | ✅ | ✅ |

**No route is classified as orphaned.** Every route absent from the top-level sidebar was checked against the actual codebase and falls into exactly one of: an intentional detail route (reached by clicking a card/record), an intentionally hidden route (documented in `Sidebar.tsx`'s own comments), an admin route (conditionally shown), or a redirect/external-link target. This matches `router.tsx`/`Sidebar.tsx` read fresh this session.

---

## 6. Edge Functions

| Function | Exists in repo | Purpose | Deployed state |
|---|---|---|---|
| `ai-chat` | ✅ | Chat/capability streaming, all intelligence engines' AI calls | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `billing-webhook` | ✅ | Provider-agnostic subscription webhook | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `delete-account` | ✅ | Self-service account deletion | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `pesapal-checkout` | ✅ | Pesapal sandbox billing | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `pesapal-ipn` | ✅ | Pesapal payment notification | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `provider-availability` | ✅ | AI provider health check | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `send-beta-invitation` | ✅ | Beta invite email | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `send-founding-pro-invitation` | ✅ | Founding Pro invite email | **UNVERIFIED — LIVE ACCESS REQUIRED** |
| `send-workspace-invitation` | ✅ | Workspace invite email | **UNVERIFIED — LIVE ACCESS REQUIRED** |

None of this session's work touched any Edge Function's source. No repo-vs-production mismatch can be asserted or ruled out without Supabase dashboard/CLI access, which is unavailable in this environment.

---

## 7. Deployment Chain

```text
Working tree
    ↓  (git status clean — verified this session, automated via `npm run verify:release`)
Commit
    ↓  (git log — verified this session)
origin/main
    ↓  (git fetch + rev-list — verified this session, automated)
Vercel build
    ↓  UNVERIFIED — LIVE ACCESS REQUIRED (no Vercel CLI/API access this session)
Production deployment
    ↓  UNVERIFIED — LIVE ACCESS REQUIRED
Database migration
    ↓  UNVERIFIED — LIVE ACCESS REQUIRED (Supabase MCP returns -32003 on every call)
Authenticated smoke test
    ↓  UNVERIFIED — LIVE ACCESS REQUIRED (no test account exists for this project by design; self-signup is beta-gated)
Release verified
```

| Stage | Currently verified by | Automated? | Manual step required? | Known failure mode |
|---|---|---|---|---|
| Working tree / commit / origin alignment | `npm run verify:release` (new, this session) | ✅ | No | None if run before every push |
| TypeScript / lint / build | `npm run verify:release` (wraps existing `tsc -b`/`oxlint`/`vite build`) | ✅ | No | None |
| Route integrity | `npm run verify:release` (spot-checks 8 known-fragile routes) | ✅ | No | List needs manual extension as new surfaces ship |
| Vercel deployment matches commit | Nothing automated exists | ❌ | Yes — check Vercel dashboard | **This is exactly the gap that let 7 commits sit unpushed/undeployed for an unknown period this session** |
| Migration application | Nothing automated exists; applied by hand via SQL Editor | ❌ | Yes — every migration in this project's history | **This is exactly the gap that let 9 entitlement migrations sit unapplied while their frontend was live** |
| Authenticated smoke test | Nothing automated exists | ❌ | Yes — no test account, no staging environment | Cannot currently be run without either credentials or a mock-Supabase harness (documented gap since `docs/ux-14-architecture-consolidation.md`) |

---

## 8. Backlog Reconciliation

| Backlog item | Historical status | Current code | Production (per user report) | Classification | Action |
|---|---|---|---|---|---|
| "Research shows Upgrade to Pro for a Pro user" | Reported as a possible product/entitlement bug | Correct, unchanged this whole investigation | Fixed (`0060` applied) | **C — Database/Migration Drift** (root cause), manifesting as **B — Deployment Drift** in the sense that code was always correct | **CLOSED — DEPLOYMENT DRIFT** |
| "Workspace Briefing shows Upgrade to Pro" | Same symptom | Correct, unchanged | Fixed (`0056` applied) | C | **CLOSED — DEPLOYMENT DRIFT** |
| Data/Analysis/Planning/Decision/Action Intelligence entitlement (same root cause, not separately reported) | Not individually reported, but structurally identical | Correct, unchanged | Fixed (`0058`,`0059`,`0062`,`0063`,`0064` applied) | C | **CLOSED — DEPLOYMENT DRIFT**, recommend one live click-through pass to confirm (not yet independently done for these five specifically) |
| "History missing from sidebar" | Looked like a possible `Sidebar.tsx` defect | Correct — was uncommitted working-tree state at the time reported, now committed+pushed | Live (per user report) | **B — Deployment Drift** | **CLOSED — DEPLOYMENT DRIFT** |
| Execution Foundation not reachable | Never separately reported as broken, but was 1 of 5 unpushed commits | Correct, complete | Live (per user report) | B | **CLOSED — DEPLOYMENT DRIFT** |
| Intelligence Ledger backend not writing | Never separately reported, but was unpushed | Correct, complete (7-engine writers confirmed) | Live | B | **CLOSED — DEPLOYMENT DRIFT** |
| `hasFeature()` swallows RPC errors into `false` | Identified during this session's audit | **Fixed this session** — now throws `EntitlementCheckFailedError` (sanitized message, fails closed unchanged) | n/a (code-level) | **A — Active Engineering Debt** | **RESOLVED this session** — see §9 |
| Execution/Ledger/History have no plan gate | Identified during this session's audit | Unchanged — deliberately not touched | n/a | **F — Product Decision Required** | **DECIDED — FREE / INCLUDED.** No gate will be added. See §9. |
| `expire_execution` unwired | Identified in the original post-Ledger integration audit | Unchanged | Live per `0065` | **G — Intentional/Future**, not a defect (server-side `expires_at` checks in `authorize_execution_request`/`start_execution` already enforce it independent of this RPC ever being called) | No action — documented, not urgent |
| `feature:pro_intelligence` shared by Workspace Briefing instead of a dedicated key | Identified during entitlement audit | Unchanged, by design (`0056`'s own doc comment) | Live | **G — Intentional** | No action |
| Every P0/P1/P2 item in `docs/arriyia-personal-release-backlog.md` (account deletion, dead code, etc.) | Resolved or accepted, per that document, before this session began | Unchanged | Unaffected by this session's work | **D — Verified/Complete** or **G — already-dispositioned**, out of this reconciliation's scope | No action — that document remains authoritative for its own scope |
| CB-05 — Reasoning Planner (`src/modules/intelligence/planner/planner.ts`) computes a plan but is never read by `buildNovaContextPrompt.ts`; still only populates a display trace | Identified in the Canonical Backlog & Production Reconciliation audit; re-confirmed directly against source this session | Unchanged — `planner.ts`'s own comment still reads "Performs no AI work"; `buildNovaContextPrompt.ts` still has no reference to planner output | n/a (code-level, no user-visible effect either way) | **D — Real Engineering Debt** | **ACTIVE — next deliberate engineering workstream.** Not implemented this session (explicitly out of scope for release closure). |

---

## 9. P1/P2/P3 Disposition

### P1 — `hasFeature()` error swallowing (RESOLVED this session)

**Before:** any RPC error (network blip, schema drift, permission issue) was caught, logged via `console.error`, and silently converted to `false` — indistinguishable from a genuine "you're not on this plan" denial, at every one of `hasFeature()`'s 8 call sites (7 engine-guard functions + `useHasFeature`, consumed by 8 UI surfaces).

**After:** `hasFeature()` now throws `EntitlementCheckFailedError` (a new exported class in `src/modules/plans/api/plans.ts`) with a fixed, sanitized message (`"We couldn't verify your plan. Please try again."`) — never the raw Supabase error text. `console.error` logging of the real error is preserved for diagnosis.

**Fail-closed behavior is unchanged and re-verified by test**: every call site that gates on `hasFeature()` already aborts if the call doesn't resolve truthy (`if (!(await hasFeature(...))) throw ...`); a thrown `EntitlementCheckFailedError` propagates through that same guard, so nothing is ever granted on an unverifiable check, exactly as before. `plans.test.ts`'s existing "fails closed" test was updated (not weakened) to assert the throw; a new test confirms the underlying Supabase error text is never exposed.

**What deliberately was not done, per this workstream's explicit "no UI redesign" scope**: none of the 7 "Upgrade to Pro" UI blocks (`ResearchPage.tsx`, `PlanningPage.tsx`, `DecisionPage.tsx`, `ActionsPage.tsx`, `DataIntelligenceQueryPanel.tsx`, `AnalysisInvestigationPanel.tsx`, `WorkspaceBriefingCard.tsx`) were modified to branch on the query's `isError` state and show a distinct "couldn't verify" message. The primitive now exists (`isError`/`error.message` on each `useHasFeature`-family hook's query result) — wiring it into 7 UI files is a small, well-scoped **P2 follow-up**, not done this turn.

### F — Execution Foundation / Ledger / History plan gating — **DECIDED / CLOSED — FREE / INCLUDED**

**Decision (final, product owner):** Execution Foundation, Intelligence Ledger, and History are **free and included for every authenticated user, regardless of plan tier.** No entitlement key will be created for these three surfaces, no migration will be added, no frontend gate will be added, and no existing execution/ledger authorization logic changes as a result of this decision.

**Current behavior (unchanged by this decision — it ratifies what was already true):** any authenticated user, on any plan including Free/Beta, can reach `/executions` and `/history`. Intelligence Ledger has no dedicated page of its own but is read by History with the same no-gate behavior.

**Rationale:**
- The upstream intelligence-*producing* capabilities (Data/Analysis/Research/Planning/Decision/Action Intelligence) remain the actual paid boundary and stay correctly gated behind `feature:*` keys — that gate is untouched by this decision.
- Execution Foundation, the Ledger, and History provide management, traceability, and auditability of what those capabilities already produced — not a second intelligence-generation surface — so gating them a second time would duplicate, not extend, the commercial boundary.
- RLS + SECURITY DEFINER RPCs continue to scope every row to its owning user regardless of plan; this was never a data-isolation question, only a monetization one, and it's now resolved.
- No commercial requirement for gating these surfaces exists anywhere in the documented record (`docs/arriyia-product-roadmap.md`, `docs/arriyia-personal-release-backlog.md`, `docs/feature-matrix.md` were all checked; none call for it).
- A second entitlement boundary here would add complexity (a new `feature:*` key, a new migration, new frontend gates, new tests) without a corresponding business reason.

**What was and was not changed to close this decision:** documentation only. No migration, no entitlement key, no frontend gate, no change to `authorize_execution_request`/`start_execution`/any Ledger RPC. The three surfaces' code is identical before and after this decision — only their disposition in the backlog changed, from an open question to a closed one.

### P2/P3 — `expire_execution` and entitlement naming

**`expire_execution`:** exists (`supabase/migrations/0065_execution_foundation.sql`), has a client wrapper (`expireExecution.ts`), no hook, no UI call site. It exists to formally transition a past-`expires_at` request's `status` to `expired` for display/audit clarity. It is **not** the actual security enforcement — `authorize_execution_request()` and `start_execution()` both independently check `expires_at` server-side and reject regardless of whether this RPC was ever called (confirmed by reading `0065`'s SQL directly, lines 274 and 333). **Classification: intentional/future, zero operational risk today.** No implementation performed — correctly scoped as not urgent.

**Entitlement naming (`feature:pro_intelligence` vs. Workspace Briefing):** reviewed per the explicit instruction not to rename a working production key for cosmetic consistency alone. Renaming would require a second migration (insert the new key for pro/founding_pro, leave the old one for backward compat or coordinate a cutover), touch `WorkspaceBriefingCard.tsx`, and buys nothing functionally — the current design is `0056`'s own deliberate choice ("the one entitlement fact every future... module will gate on"). **No change made — documented as intentional.**

---

## 10. Release Process Hardening (implemented this session)

- **`npm run verify:release`** (`scripts/verify-release.mjs`, new) — one command that checks working-tree cleanliness, branch/HEAD, `origin/main` alignment (best-effort network fetch, never fatal if unavailable), `tsc -b`, `oxlint`, `vite build`, and route integrity for 8 previously-fragile routes, then prints an explicit `REMOTE REQUIRED` section for everything it structurally cannot verify (Vercel deployment state, migration application, live entitlement resolution, authenticated smoke test) — it never reports `REMOTE PASS` without live access. Modeled directly on the existing `npm run verify:bundle` precedent in this repo.
- **Migration automation into CI/CD**: investigated, not implemented. This would require Supabase CLI credentials/CI configuration not present in this repository or session — flagged as the concrete next step (see §12) rather than pretended to be done.
- **Production smoke test**: not automated this session — no test account exists for this project by design (beta-invite-gated signup, no staging environment, single shared production Supabase backend — same constraint this project's own `docs/ux-14-architecture-consolidation.md` already documented). Recommended minimum manual smoke test, to run after every deploy: sign in as a known Pro account → confirm Research/Data/Analysis/Planning/Decision/Action/Workspace Briefing show no false "Upgrade to Pro" → confirm `/history` and `/executions` load → confirm Collaboration still works (the one capability that's worked correctly throughout, useful as a regression control).

---

## 11. Final Release Gate

```text
ARRIYIA PRODUCTION TRUTH — FINAL RECONCILIATION

Git:                              PASS
Repository:                       PASS
Build:                            PASS
Routes:                           PASS
Entitlements:                     UNVERIFIED (reported PASS by user; not independently confirmed — MCP access blocked)
Database migrations:              UNVERIFIED (0065/0066 independently confirmed; 0056-0064 reported applied, not independently confirmed)
Vercel production:                UNVERIFIED (no live access)
Execution:                        PASS (code + push confirmed; live behavior UNVERIFIED)
Intelligence Ledger:              PASS (code + push confirmed; live behavior UNVERIFIED)
History:                          PASS (code + push confirmed; live behavior UNVERIFIED)

P1:                                RESOLVED (hasFeature() error swallowing hardened, tested, committed)
P2:                                1 open (UI wiring for check-failed state — small, deferred, not urgent)
P3:                                1 open (mock/staging environment for future live verification)

Production blockers:               0
Product decisions required:        0 — Execution/Ledger/History plan gating DECIDED: FREE / INCLUDED
Backlog items closed as deployment drift: 6 (Research, Workspace Briefing, Data/Analysis/Planning/Decision/Action entitlement as one root cause, History-missing, Execution unreachable, Ledger backend unreachable)
Genuine engineering items remaining: 2 (P2 UI wiring, P3 staging environment) + CB-05 (Reasoning Planner not wired into the live prompt — identified in the Canonical Backlog & Production Reconciliation, not implemented, tracked as the next deliberate engineering workstream)

Overall release state:             YELLOW
```

YELLOW, not GREEN, specifically because the database/Vercel layer rests on the user's own report rather than this session's independent verification — not because anything is known to be broken.

---

## 12. Pricing, Founding Pro Access & Legacy Beta Consolidation

**Beta retirement (public/customer-facing):** confirmed already true before this workstream started — `usePublicPlanCatalog.ts`'s `PUBLIC_PLAN_CODES` never included `beta`, and `resolvePlanIdentity()` already mapped a `beta` plan code to the "Free" identity label everywhere in the app shell. No code change was required for this half of the objective; it's recorded here as verified, not newly built.

**Founding Pro is the active controlled-access modality:** `AdminFoundingProPage.tsx` (`/admin/founding-pro`) already implements the full Request → Review → Approval → Grant → Invitation/Onboarding → Entitlement pipeline end to end (application submission, admin approve/reject, priced invitation, email delivery, self-service acceptance, enrollment, member registry, lifecycle audit log) — built in the earlier Founding Pro Programme phases, unchanged by this workstream. This is architecturally distinct from `beta_invites`/`is_beta_invited()` (the platform's general signup-access gate, checked by `AuthContext.signUpWithPassword` before every account creation, predating Founding Pro and not specific to any one plan) — the two were never the same mechanism, and this workstream did not merge them into one.

**Administrative access-request panel — retained and repurposed:** `AdminDashboardPage.tsx`'s invite section, renamed from "Beta Invites" to "Access Invites." It still creates/revokes/emails invites through the same `beta_invites` table and the same `admin_create_beta_invite`/`admin_revoke_beta_invite`/`admin_list_beta_invites`/`send-beta-invitation` RPCs/Edge Function — no new access-management architecture, no duplication of the Founding Pro Programme's own request/review flow. What changed: the form now requires an explicit plan choice (Free/Student/Pro/Founding Pro/Enterprise, sourced from the live `plans` table, excluding `beta`) rather than silently submitting `plan_id: null`, which previously always fell back to the legacy `beta` plan inside `assign_default_plan()` (0044). That DB function's fallback is deliberately left unchanged — legacy behavior for legacy data, not touched by a migration — but the admin UI can no longer trigger it, which is what actually stops new signups from landing on the retired plan. A direct link to the Founding Pro Programme page was added so an admin doesn't reach for this generic tool when the applicant-facing flow is the right one.

**Legacy Beta records:** untouched — no user, `user_plan_assignments` row, or `beta_invites` row was deleted, modified, or reassigned. The `plans.code = 'beta'` row itself is untouched (no rename, no deactivation). The one visible admin-UI change: the "Beta plan" user-count stat tile on `/admin` is now labeled "Legacy Beta," distinguishing existing Beta-plan users from Founding Pro applicants/members without altering their plan, quotas, or entitlements in any way.

**Student plan:** introduced as a real `plans` row (migration `0067_student_plan.sql`, following `0045_founding_pro_plan.sql`'s exact precedent). Positioning: "For students, researchers and academic users." `monthly_price_cents`/`annual_price_cents` left `NULL` — no authoritative Student pricing exists anywhere in this repository's migration history (in fact no plan's price is set at all; Phase 5A's own migration comment records that pricing was deliberately left unset pending a payment-provider/business decision), and this workstream does not invent one. `storage_bytes` and `feature:collaboration` are seeded to mirror Free's exact values (500MB, no collaboration) — a starting default, explicitly not a final entitlement decision, following the same "starting default, not baked-in business decision" framing `0045` used for Founding Pro's initial quota. `ai_messages` is deliberately left unseeded (no row — the pricing UI already renders this as a generic "AI messages / month" line rather than inventing a number), because this repository has no authoritative `ai_messages` figure for *any* plan in its migration history to derive one from. `plan_ai_providers` is seeded (mirrors Free's single-provider default) because an empty set there is a functional outage, not an open pricing question. Added to `usePublicPlanCatalog.ts`'s fetched codes so it renders on `/pricing`.

**Pricing card UX:** `PlanCard` restructured into name → price → one-line value proposition → short key-capability list → CTA (front-end-only copy, `VALUE_PROP` constant, mirroring the pre-existing `CORE_FEATURES` pattern — no plan/quota data was invented or hardcoded). A new collapsible "Compare plans / full capabilities" section below the cards shows the complete quota comparison (price, AI messages, storage, collaboration) across every fetched tier, sourced from the same `usePublicPlanCatalog` data the cards already use. Grid widened from 3 to 4 columns (`lg:grid-cols-4`) to fit Founding Pro + Free + Student + Pro without crowding.

**Free price rendering fix:** the hardcoded literal `$0` in `PlanCard` is replaced with the word "Free," driven by the same `isFree` branch that already existed — no currency symbol is embedded for a plan with no price, and paid-plan currency formatting (`formatPrice`, which already reads `tier.currency` from the catalog) is unchanged.

**Product decisions required (owner input needed):**
- Student's actual differentiating entitlements (a real `ai_messages` limit, and whether storage/collaboration should differ from Free) — currently a placeholder mirroring Free, changeable at any time via the existing `admin_update_plan_quota` RPC exactly like every other plan's quotas.
- Student's price (currently unset, same "to be announced" state every plan is in).
- Whether the "Access Invites" tool should ever be simplified/retired now that Founding Pro has its own dedicated application flow — not decided here; it remains the platform's only general signup-access gate, so it stays.

**Remaining Beta references (intentionally retained, not stale):** `beta_invites` table/RPC/Edge-Function names, the `admin-beta-invites` React Query key, `plans.code = 'beta'` itself, the `/admin/beta` deprecated redirect route, and every historical sprint document under `docs/` — all internal/technical/historical, none customer-facing, none renamed (renaming would be pure churn against a real persisted identifier or a settled historical record, not required by this workstream's objective).

## 13. Notification Foundation & Background Intelligence Phase 1

**Problem closed:** a Collaboration invitation (`invite_to_workspace`, existing-user branch) persisted a `workspace_members` row correctly, but the recipient had no ambient way to discover it short of manually visiting `/settings/workspaces` — the TopBar bell was a decorative, permanently-disabled button (`title="No notifications yet"`). Email delivery (separately known to be broken — missing `RESEND_API_KEY`) was never the cause; it and the missing in-app signal are two independently-failing steps that happened to look like one problem.

**Data model:** `supabase/migrations/0068_notifications.sql` adds one table — `notifications (id, recipient_user_id, type text, payload jsonb, read_at timestamptz | null, created_at)`. `type` is a free-form string (only `'collaboration_invitation'` is produced today) and `payload` is an unstructured jsonb bag shaped per `type`, specifically so a future notification producer registers a new `type` value rather than needing a schema change. `read_at is null` is the sole unread signal — no separate `is_read` boolean exists anywhere.

**Security:** RLS grants SELECT of a user's own rows only (`auth.uid() = recipient_user_id`); there is no client-facing INSERT or UPDATE policy at all. Every write goes through a SECURITY DEFINER function: `mark_notification_read(p_notification_id)` and `mark_all_notifications_read()` (both re-check `recipient_user_id = auth.uid()` inside the function body, not just relying on RLS bypass), and the one producer, `invite_to_workspace` itself. There is no client-callable "create a notification for an arbitrary user" API — confirmed by `supabase/tests/notifications_security_test.sql` (9 test blocks: correct-recipient creation, cross-user SELECT isolation, `mark_notification_read`/`mark_all_notifications_read` write isolation, no notification on a failed invite, no duplicate on resend of an already-pending invite, a genuine notification on re-invite after removal, no client-side INSERT path, no client-side UPDATE path, anon denial). Written against this repository's established SQL-security-test convention (`begin; ... rollback;` blocks, `request.jwt.claims`, the same vetted rollback-safe user set `pro_intelligence_foundation_security_test.sql` uses) but **not executed live from this session** — this sandbox has no approved Supabase project connection (`mcp__Supabase__list_projects` requires approval this session did not have), consistent with every other "cannot verify live production from this environment" note elsewhere in this document. Running this file against the real database is the one verification step still owed before this migration is treated as fully proven, not just reviewed.

**Invitation write path:** `invite_to_workspace` (currently defined by `0046_feature_entitlements_and_storage_quota.sql`) is re-declared with `create or replace`, reproducing every existing line verbatim (ownership check, `has_feature(auth.uid(), 'collaboration')` entitlement gate, invitee resolution, the pending-membership upsert, the unknown-email `workspace_invitations` fallback) and adding exactly two things, both scoped to the existing-user branch only: a pre-upsert `select exists(...)` check for an already-`pending` row (`v_already_pending`), and — only when that check is false and the upsert actually returns a row — one `insert into notifications` with `type = 'collaboration_invitation'` and `payload = {workspace_id, workspace_name, inviter_user_id, inviter_name}`. Running inside the same function/transaction as the membership write means "never notify on a failed invite" and "never duplicate on a mere resend" both fall out of ordinary transactional atomicity, with no trigger or second write path to keep in sync. The unknown-email branch (`workspace_invitations`) is untouched — there is no `recipient_user_id` to notify until `handle_new_user` resolves it at signup, unchanged by this phase.

**Client layer:** `src/modules/notifications/api/notifications.ts` (`listNotifications`, `markNotificationRead`, `markAllNotificationsRead`) and `src/modules/notifications/hooks/useNotifications.ts` — a `useQuery` over the list plus two `useMutation`s, following this codebase's one established data-access pattern (React Query, mirroring `usePendingInvitations`) with no second pattern introduced. Unread count is derived (`.filter(n => n.read_at === null).length`), never stored.

**Bell:** `TopBar.tsx`'s disabled placeholder button is replaced by `src/modules/notifications/components/NotificationBell.tsx`, reusing the existing `DropdownMenu` primitive (extended with one additive, backward-compatible `panelClassName` prop for a wider panel — the other 7 existing consumers are unaffected) rather than a second popover implementation. No notifications renders the plain bell with no badge and "No notifications yet." inside the panel; unread notifications show a small numeric badge (capped at "9+"). Each row shows an icon, a rendered message (e.g. "Ding invited you to join Mtoni Research Workspace"), a relative timestamp (`formatRelativeTime`, reused as-is), and an unread/read visual distinction. Clicking a Collaboration row marks it read and navigates to the existing `/settings/workspaces` surface — no second invitation-management UI was built.

**Mobile:** no separate mobile work was needed. `TopBar.tsx` renders its icon row (including the bell) identically at every breakpoint — there are no `hidden`/`md:hidden` classes on the bell specifically — so the new bell is already present in the mobile information architecture without any placement change.

**Refresh behavior:** no realtime/WebSocket/Supabase Realtime subscription was added. Discoverability on a normal page load or tab refocus comes from the existing global `queryClient` defaults (`staleTime: 30_000`, default refetch-on-focus) that every other query in this codebase already relies on — matching the acceptance bar ("reliable discovery via the bell without manually visiting Settings," not instant push) without introducing new infrastructure.

**Email decoupling:** unchanged by design, not by omission — the notification insert lives inside `invite_to_workspace`'s own DB transaction, which has never called and does not call the email-sending edge function; `sendInvitationEmailForResult` remains a separate step the *client* mutation hook (`useWorkspaceMembers.invite`) calls afterward, already tolerant of failure (`emailError` surfaced independently of RPC success, pre-existing behavior). A DB-side notification therefore cannot be prevented by `RESEND_API_KEY` being unset; no code under `supabase/functions/` was touched.

**Tests:** `notifications_security_test.sql` (DB/security, 9 blocks, written but not yet run live — see above); `src/modules/notifications/api/notifications.test.ts`, `.../hooks/useNotifications.test.ts`, `.../components/NotificationBell.test.ts` (20 tests total, all passing) covering the API call shapes, loading/unread-count/mark-read/mark-all/empty/error states, and bell rendering/badge/open/route/read-transition behavior.

**Future Background Intelligence extension (documented, not built):** the intended shape is `EVENT → DURABLE STATE (this table) → NOTIFICATION DECISION → DELIVERY CHANNEL`, with `notifications.type`/`payload` already generic enough to carry future event sources — additional Collaboration/Workspace/Knowledge events, AI-generated insights, scheduled intelligence, system notices — without a schema rewrite, and future delivery channels (email, push, digest) as consumers that read the same durable row rather than a parallel notification store. None of that is implemented here: no scheduled jobs, no `pg_cron`, no AI-generated notifications, no digests, no push/browser notifications, no autonomous agents, no event bus. This phase's only producer is `invite_to_workspace`; the only consumer is the bell.

**Product/commercial implications:** none introduced. Notification creation is not gated by plan — it piggybacks on `invite_to_workspace`'s existing `has_feature(..., 'collaboration')` check (a Free-plan user can never reach the notification-creating code path in the first place, since they can't invite at all), so no new entitlement decision was needed or invented.
