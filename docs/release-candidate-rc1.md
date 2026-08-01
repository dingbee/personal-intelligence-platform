# NOVA PIP — Release Candidate RC1

Read-only release-readiness report. No merge, deploy, or migration has been performed as part of producing this document — merging `claude/pip-edge-function-deploy-9lzs8n` into `main` is a product decision, not something this report executes.

## Repository status

- Repo: `dingbee/personal-intelligence-platform`
- Deploy target: Vercel, static SPA (`vercel.json` — single catch-all rewrite to `index.html`, no environment-specific config)
- Backend: Supabase project `uzshazetfkjkrdnxwjtl` (ACTIVE_HEALTHY), shared by both `main` and this branch — there is only one backend, not one per branch

## Branch status

- Candidate branch: `claude/pip-edge-function-deploy-9lzs8n`
- Base: `origin/main` @ `4a91ef5` ("Stabilization Sprint: NOVA PIP Manual — all 8 chapters")
- `git rev-list --left-right --count origin/main...HEAD` → `0  12` — main has nothing this branch lacks; the branch is a strict superset of main (fast-forward merge, no conflicts possible)
- Working tree clean, all local changes committed and pushed as of `0065f7d`

## Commits ahead of main (12)

| Commit | Summary |
|---|---|
| `aff0eac` | Universal Search Maturity — cross-provider ranking, hybrid search, zero-result recovery |
| `e05371d` | Docs: Universal Search Maturity |
| `f99caf3` | Knowledge Confidence scoring |
| `78524d1` | Docs: Knowledge Confidence scoring |
| `33e9808` | Knowledge Actions v1 (Merge Notes, Generate Briefing, Export Knowledge Package) |
| `0c88ce8` | Knowledge Collections v1 |
| `3655bbe` | Natural Language Knowledge Commands v1 (Executive Briefing) |
| `85f4605` | Platform Integration Sprint (now "Coherence Sprint v1") — cross-feature fixes |
| `095aed9` | AI Workspace Actions v1 — Save to Notes (button + NL commands) |
| `4d9246c` | Platform Coherence Sprint v2 — nav, terminology, source resolution, error states |
| `e0a49ab` | Docs: Platform Integration Sprint → Coherence Sprint v1 rename |
| `0065f7d` | Reliability & Truth Audit — 5 confirmed defects fixed |

91 files changed, 3,416 insertions(+), 216 deletions(-) relative to `main`.

## Database migrations included

**One** new migration file relative to `main`: `supabase/migrations/0026_knowledge_collections.sql` (creates `knowledge_collections` — id/user_id/workspace_id/name/description/timestamps, RLS enabled, user-scoped policy, two indexes; purely additive, no destructive statements, no column changes to existing tables).

**Already applied to the live database** — confirmed via `mcp__Supabase__list_migrations`: the live project's migration history includes `20260801121041_knowledge_collections`, applied ahead of this report being written. **This means the database is not a deployment step for this release.** Schema and code are already reconciled; merging `main` only needs to catch the frontend/migration-tracking up to what the database already has.

No other schema changes are part of this release — everything else in the 12-commit diff is application code (React/TS) and documentation.

## Breaking changes

None found. Specifically checked:
- `src/shared/types/database.ts` diff vs. `main` is additive-only (one new type, `KnowledgeCollection`, one new `Database['public']['Tables']` entry) — no existing field renamed, removed, or retyped.
- No changes to `supabase/functions/**` — both deployed edge functions (`ai-chat` v10, `provider-availability` v6) are untouched by this branch and already `ACTIVE` in production; no edge function redeploy is required as part of this release.
- No route removed, only routes added (`router.tsx` diff is additive).
- No public API/exported-function signature was changed in a way that breaks an existing caller — new functionality is either net-new modules (`workspace-actions/`, `knowledge-intelligence` additions) or additive props/fields on existing components (e.g. `InsightPanel`'s new `isError`/`onRetry` are optional).

## Feature flags

**None exist in this codebase.** There is no feature-flag mechanism (`grep` for flag-related patterns across `src/` returns nothing) — deployment is all-or-nothing per Vercel build. This is worth naming explicitly as a gap: everything in this release goes live to every user simultaneously the moment it deploys, with no ability to stage rollout or kill-switch an individual feature short of a full revert.

## Rollback plan

No database rollback is required (the one migration is additive and already applied — reverting the frontend doesn't require reverting the schema; unused tables/columns are harmless).

Frontend rollback is a standard Vercel revert:
1. Vercel keeps the previous production deployment (built from `main` @ `4a91ef5`) available — promote it back via the Vercel dashboard/CLI, or push a revert commit to whatever branch Vercel tracks for production and let it redeploy.
2. No data migration is needed to go backward: the additive `knowledge_collections` table and its rows (if any are created post-deploy) simply become unused again; nothing else changed shape.
3. Estimated rollback time: however long a Vercel deployment promotion takes — typically under a minute — since no backend action is required.

## Deployment sequence

Given the database already has everything this release needs:

1. Merge `claude/pip-edge-function-deploy-9lzs8n` into `main` (fast-forward, no conflicts expected per the `0  12` ahead/behind count).
2. Deploy `main` via Vercel (however this project's Vercel project is triggered — push-to-deploy or manual).
3. No migration step needed (already live). No edge function deploy needed (already live and unchanged).
4. Run the Post-deployment verification checklist below against the live URL.

## Post-deployment verification checklist

Derived directly from the Reliability & Truth Audit's ❌ Blocked list — these are the capabilities that cannot be verified until this deploys, because there is currently nothing live to verify them against:

- [ ] AI Workspace Actions: per-message Save button creates a note with correct provenance
- [ ] AI Workspace Actions: "save this" / "remember this" / "capture this" / "add this to my notes" (and the widened phrasings — "save this to notes," "can you save this," etc.) trigger the save workflow in a real chat
- [ ] Knowledge Confidence badge renders on Explorer and Dashboard cards, not just the drill-down page
- [ ] Knowledge Actions: Merge Notes, Generate Briefing, Export Knowledge Package all complete end-to-end; Merge Notes' new error state is reachable if forced to fail
- [ ] Knowledge Collections: create a collection, add/remove items across at least two source types, membership shows correctly from both directions
- [ ] Natural Language Knowledge Command ("Create an executive briefing on X") resolves a real concept and produces a linked note
- [ ] Knowledge Explorer cards navigate to the concept drill-down page
- [ ] Content Connections (`/knowledge/graph`) loads without the client-side error seen in mocked testing (expected to be clean against the real PostgREST backend, per Phase 1 root-cause, but confirm against live data as the final check)
- [ ] Explorer/Dashboard show a distinct error state (not "empty") if a knowledge fetch is forced to fail
- [ ] Collection membership error/retry states behave correctly under a forced failure
- [ ] Spot-check `ai_requests` in the AI Health Dashboard after deploy to confirm no new error classes appear beyond the known configuration issues (missing provider keys, low credit balance) already present

## Known limitations

Carried over from the Reliability & Truth Audit, not fixed as part of this release because each requires either a product decision or new infrastructure, not a bug fix:

- **One historical note** (`3bb041d4-...`) is missing its search embedding, from before the `SaveConversationDialog` indexing fix. Will not self-heal on deploy — needs an explicit decision on whether to backfill it.
- **`relatedConceptCount` cap discrepancy**: Explorer/Dashboard confidence math uses a 200-edge-capped fetch; Evidence/drill-down uses an unbounded per-node query. Only visible in a workspace with 200+ total edges; not fixed because a proper fix needs new query infrastructure.
- **No feature-flag system** (see above) — every capability in this release ships to all users at once.
- **Provider configuration gaps are real and pre-existing in production**: `ANTHROPIC_API_KEY`/`GOOGLE_API_KEY` missing in some requests, and an Anthropic credit-balance-too-low condition, both already observed in live `ai_requests`. Not part of this release's code — an operational task (configure secrets / top up credits) independent of the merge.
- **Security/performance advisories** (mutable `search_path` on 4 functions, `vector` extension in `public` schema, `handle_new_user()` SECURITY DEFINER reachable by `anon`/`authenticated`, leaked-password protection disabled, several RLS policies re-evaluating `auth.*()` per row) predate this release and are unrelated to it — flagged for a separate hardening pass, not a blocker for this deploy.
- **No feature-branch-per-environment or staging deploy** exists for this project (single Supabase project, single Vercel target) — verification against a real staging environment before hitting production isn't currently possible with this setup; the post-deployment checklist above is run directly against production.

## Go / No-Go recommendation

**Go**, with the checklist above run immediately after deploy.

Rationale: zero commits behind main (no merge conflicts possible), the one schema change is additive and already live, no edge function changes, no breaking API/type changes, and every defect this audit found has already been fixed and verified (tsc/954 tests/lint/build clean) prior to this report. The absence of a feature-flag system and staging environment are real gaps in this project's release infrastructure — worth fixing at some point — but they don't change the risk profile of *this specific* release, since the alternative (staying on `main`) means the already-fixed defects and the entire Knowledge Intelligence initiative continue to be unavailable in production for no benefit.

Residual risk is concentrated in the "Known limitations" above, all of which are either already-mitigated (Provider Fallback Chain handles the config gaps gracefully) or explicitly non-blocking data/infra follow-ups, not defects in this release's code.

This report does not itself authorize the merge — that step is the user's call, per the standing rule that a change affecting the live production application requires explicit sign-off before execution.
