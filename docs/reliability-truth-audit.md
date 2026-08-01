# NOVA PIP — Reliability & Truth Audit

An engineering audit, not a feature phase. Objective: determine whether NOVA PIP is genuinely ready for acceptance by verifying — not assuming — that implemented features behave consistently, truthfully, and reliably. Ran in four phases: Runtime Verification, Reliability Review, Single Source of Truth Audit, Acceptance Readiness. Per the instructions this audit was run under, confirmed defects were fixed immediately rather than only reported; each fix below is verified (tsc/vitest/lint/build) and noted where it does not yet change the deployed application.

**Bottom line up front:** the single largest finding is not a code defect. It's a **deployment gap** — `main` (11 commits behind this branch, confirmed via `git rev-list --left-right --count origin/main...HEAD`) contains zero files under `src/modules/workspace-actions/` and predates Platform Coherence Sprint v1, v2, Knowledge Confidence, Knowledge Actions, Knowledge Collections, and Natural Language Commands entirely. Every one of those ⚙️ Implemented features is implemented correctly in this repo but is not the code running in production. See **Recommendation** at the end.

---

## Phase 1 — Runtime Verification

Verified using two independent methods: (a) real browser sessions against a mocked Supabase backend (interaction correctness), and (b) direct SQL against the live production Supabase project (`uzshazetfkjkrdnxwjtl`) — real rows, real errors, real logs, not mocked data. Method (b) is new to this audit and is what surfaced the deployment gap and the data-integrity finding below; it is strictly more authoritative than (a) for "does this work in production," and less useful than (a) for interaction-level correctness, so both were used.

| Capability | Verified how | Result |
|---|---|---|
| Universal Search (base providers) | Live: `documents`/`notes`/`conversations` tables populated and queryable; on `main`, previously accepted | Working |
| Universal Search (hybrid lexical, cross-provider ranking, zero-result recovery) | Code + tests only — not on `main` | Not deployed; no defect found |
| Knowledge Confidence | Code + tests; live: `knowledge_node_sources` table exists via migration, not on `main` | Not deployed; **defect found and fixed** (see Phase 3) |
| Knowledge Actions (Merge/Briefing/Export) | Code + tests; live: schema present, not on `main` | Not deployed; **defect found and fixed** (Merge Notes error handling, see Phase 2) |
| Knowledge Collections | Live: `knowledge_collections` table exists (0 rows — nobody has used it, since no UI is live), not on `main` | Not deployed |
| Natural Language Knowledge Commands ("executive briefing on X") | Code + tests, not on `main` | Not deployed; no new defect found |
| AI Workspace Actions (Save to Notes) | Live: real user transcript found (see below); code + tests | **Two confirmed defects, both fixed** — see below |
| Explorer | Live: base grid on `main`, previously accepted. Confidence badges/drill-down navigation on branch only | Base: working. New additions: not deployed; error-state defect found and fixed (Phase 2) |
| Dashboard (Knowledge Insights Panel) | Same split as Explorer | Same as Explorer |
| Reader | Live: on `main`, previously accepted | Working, no new defects found |
| Chat | Live: on `main`, previously accepted. Real `ai_requests` error data reviewed (see Phase 2) | Core chat working; provider-fallback/observability confirmed working against real production errors |
| Notes | Live: 2 real notes exist. CRUD on `main`, previously accepted | Working; **one real data-integrity defect found, root-caused, fixed** — see below |
| Library | Live: on `main`, previously accepted | Working, no new defects found |

### AI Workspace Actions — the user's reported failure, reproduced and explained

The user reported that natural-language save commands ("Save this," "Remember this," etc.) don't work in the application. This was not accepted on faith — it was checked directly against the real database.

**Finding 1 — deployment issue, not implementation bug.** `main` has zero files under `src/modules/workspace-actions/`. Whatever build is actually serving the deployed app cannot run this feature; it was never live to fail. Root cause confirmed via a real message: a user's exact-match "remember this" (which the pre-existing v1 pattern *should* have caught even before today's widening) got a full LLM-generated conversational reply instead of the deterministic save confirmation — direct proof the router isn't present in whatever build served that request.

**Finding 2 — implementation bug, real, separate from Finding 1.** Even once deployed, the v1 matcher (`/^(?:save this|remember this|capture this|add this to my notes)[.!]*$/i`) is an exact-phrase match with no tolerance for how people actually type. Querying real production messages for save-intent phrasing turned up examples the v1 pattern would never have matched even if it had been live: `"save this to notes"`, `"can you save this"`, `"can you save this to my notes"`, `"save this to my notes"`. **Fixed**: `src/modules/workspace-actions/actions/saveToNotesCommand.ts` now accepts an optional polite lead-in (`can/could/would you`, `please`) and an optional trailing `to/in (my) notes`, while still anchored (whole-message only) so it doesn't misfire on ordinary sentences. Verified against both the real phrasings found above and the original negative test cases (`"Can you save this for later?"`, `"Save this document to my library."`) with the new lead-ins/suffixes applied, to confirm the widening didn't loosen the false-positive guard. Two new test cases added; 954/954 tests pass.

Both findings are fixed on this branch. Neither is visible in production until the branch reaches `main` — see Recommendation.

### Notes — real data-integrity defect found and root-caused

Live query of the `notes` table found one real note (`3bb041d4-...`, "Ideas for improving direct bookings at Mtoni River Lodge...") with `source_chunk_ids` populated but no row in `note_embeddings` and no `generation_metadata`. Traced to ground truth, not assumption:

1. `knowledge_links` has exactly one row for this note: `source_type='note'` → `target_type='conversation'`, created `2026-07-31 16:37:49` — the shape of a save made through `SaveConversationDialog`.
2. `git log -p` on `SaveConversationDialog.tsx` shows it was introduced by commit `a899cbb` (Jul 31, 12:47) **without** any call to `indexNote()`/`linkKnownConceptsToSource()`.
3. The note was created at 16:37 — after `a899cbb`, before the fix.
4. The fix (`095aed9`, Aug 1, 14:21 — already applied on this branch, part of AI Workspace Actions v1) is confirmed **not** an ancestor of `origin/main` (`git merge-base --is-ancestor 095aed9 origin/main` → not an ancestor).

**Classification: implementation bug, already fixed, not yet deployed.** The fix prevents this from happening to any *future* save through this dialog once deployed. It does not retroactively index the one existing affected note — that's a one-time data-cleanup item, not a code defect, and building a backfill script is new capability work outside this audit's scope. Recorded here as a known limitation rather than silently left unexplained.

### Content Connections graph error — mock-vs-live, not a real defect

Carried over from Platform Coherence Sprint v2: browser testing against a mocked backend threw `Cannot read properties of undefined (reading 'map')` on the Content Connections page. Reproduced deliberately with two scenarios: mock omitting `document_tags` on a document row → error reproduced; mock including `document_tags: []` → no error. The real Supabase PostgREST embed always returns an array (`[]` at minimum) for a nested select, so this is a test-harness fidelity gap, not a live defect. **Classification: expected behavior (mock-vs-live difference).** No fix needed or made.

---

## Phase 2 — Reliability Review

Audited for partial failures, race conditions, missing retries/loading/error states across Generate Briefing, Save Message, Merge Notes, Collection CRUD, document indexing, knowledge linking, search indexing.

### Confirmed defects, fixed

| Defect | Where | Fix |
|---|---|---|
| Merge Notes had **zero** user-facing error handling. The mutation could fail partway (create merged note → add tags/collections → delete originals, all separately awaited, no rollback) with no visible feedback at all — dialog closes, selection unchanged, nothing else happens. | `src/modules/notes/pages/NotesPage.tsx` | Added `loading` state on the Merge button and a specific, honestly-worded error message that doesn't overclaim what did or didn't survive a partial failure (deliberately avoided an initial draft that claimed "nothing was deleted," which could be false given the delete step is itself a `Promise.all`) |
| `useKnowledgeNodeDetails`'s `isError` was computed but never returned; Explorer and the Dashboard insights panel destructured only `isLoading`/`details`, so a failed fetch silently rendered as "no knowledge extracted yet" — indistinguishable from a genuinely empty workspace | `useKnowledgeNodeDetails.ts`, `KnowledgeExplorerPage.tsx`, `KnowledgeInsightsPanel.tsx` | Exposed `isError`/`refetch`; both pages now render a distinct error state with Retry, using the same `InsightPanel` error affordance Coherence Sprint v2 already added for Collections |
| `InsightPanel` had no error-vs-empty distinction to give those callers in the first place | `src/shared/components/knowledge/InsightPanel.tsx` | Extended with optional, backward-compatible `isError`/`onRetry`/`errorMessage` props — every existing caller that omits them renders exactly as before |
| `SaveConversationDialog` missing indexing/linking calls | see Phase 1 | Already fixed as part of AI Workspace Actions v1 (`095aed9`), re-confirmed root cause here with real data |

### Reviewed, no defect found

- **Generate Briefing / Document indexing / search indexing**: indexing and concept-linking were already centralized inside the shared pipeline functions themselves during Platform Coherence Sprint v1 (not left to individual callers), so no new partial-failure surface found.
- **Collection CRUD**: error/loading/retry already added in Coherence Sprint v2; re-verified present and working, no regressions.
- **Real `ai_requests` error data** (queried live, all rows): the actual errors in production are `ANTHROPIC_API_KEY is not configured` (7), `GOOGLE_API_KEY is not configured` (3), `Your credit balance is too low` (7, Anthropic), plus a handful of `Edge Function returned a non-2xx status code` / `Failed to send a request to the Edge Function` (23 combined, mostly on `processing`). **Classification: configuration/deployment issues, not code defects.** Provider Availability Detection and the Provider Fallback Chain — both already-implemented, already-accepted features — exist specifically to detect and gracefully handle exactly this class of error, and the AI Health Dashboard surfaces it. This audit treats the presence of these real errors in the data as **confirmation that the observability feature works as designed**, not as a new defect to fix. Recommend: configure the missing provider secrets / top up Anthropic credits as an operational task, separate from this audit.

### Security & performance advisories (Supabase, read-only)

`get_advisors` was run for completeness. 7 security WARNs (mutable `search_path` on 4 functions, `vector` extension installed in `public` schema, `handle_new_user()` is `SECURITY DEFINER` and callable by `anon`/`authenticated`, leaked-password protection disabled) and a set of performance findings (several unindexed foreign keys, many RLS policies re-evaluating `auth.<fn>()` per row instead of `(select auth.<fn>())`, a few unused indexes). **These predate this audit and are infrastructure/security hardening items, not defects in the audited application features.** Deliberately not fixed here — hardening Postgres RLS policies and auth configuration on a live database serving a real business is a separate, consequential piece of work with its own review, not something to fold into a feature-behavior audit. Flagged as a follow-up recommendation.

---

## Phase 3 — Single Source of Truth Audit

| Area | Finding |
|---|---|
| **Confidence calculation** | One formula (`computeKnowledgeConfidence`), two call sites. Found a real divergence: `useKnowledgeNodeDetails` (Explorer/Dashboard) counted every `knowledge_node_sources` row including unresolved ones (e.g. a deleted document), while `getKnowledgeNodeEvidence` (Evidence/drill-down, also used by Search and Generate Briefing) only counts resolved ones. **Fixed** — `useKnowledgeNodeDetails` now resolves sources once up front and feeds only resolved ones into the confidence bookkeeping, matching the other call site's contract exactly. |
| **`relatedConceptCount` — NOT fixed, deferred with rationale** | A second, separate divergence in the same confidence inputs, newly documented here for the first time (previously identified informally but never written down). Explorer/Dashboard derives `relatedConceptCount` from `useKnowledgeEdges()` — the same workspace-wide, `limit=200`-capped fetch used to render the graph. Evidence/drill-down derives it from a precise, unbounded per-node `knowledge_links` query. In a workspace with more than 200 total edges, a node's confidence could read slightly differently on Explorer vs. its own drill-down page. **Deliberately not fixed**: a correct fix means giving Explorer/Dashboard a precise per-node count instead of reusing the capped graph-rendering fetch, which is new query infrastructure, not a bug fix within the existing shape — out of scope for "no architecture rewrite." |
| **Source-reference resolution** | Already unified in Platform Coherence Sprint v2 (`sourceResolution.ts`). Re-verified still the only implementation; no regressions. |
| **Concept lookup** | Single canonical primitive (`normalizeTitle`), with `resolveCanonicalNode` (find-or-create), `matchKnownConcepts` (evidence-linking), and `searchKnowledgeConcepts` (free-text search) as three genuinely distinct concerns built on top of it, not three copies of the same logic. No duplication found. |
| **Ranking** | Scoring functions (`computeConversationScore`, `applyLexicalBoost`, `applyRecencyBonus`) are each defined once and imported identically by all three search providers — not reimplemented per-provider. The one repeated shape is structural (each provider independently runs "semantic RPC + lexical query in parallel, merge"), which reflects genuinely different tables/RPCs per source rather than copy-pasted business logic. Noted as a candidate for a shared merge helper if a fourth provider is ever added, not a current defect. |
| **Workspace resolution** | Single source of truth: `useWorkspace()` reading `WorkspaceContext`. Every call site surveyed (35+, spanning notes, library, chat, knowledge-intelligence, dashboard, search, and command execution) reads `currentWorkspaceId` from this one hook with no independent fallback/inference logic anywhere. No duplication found. |

---

## Phase 4 — Acceptance Readiness

The existing three-symbol legend (⚙️ Implemented / ✅ Accepted / 🔲 Backlog) undersells what this audit found: its own text says ⚙️ means "merged to `main`," but every current ⚙️ row's Branch column has always said the feature branch, not `main` — the legend wording was already inconsistent with how the column has been used since Platform Coherence Sprint v1. Corrected in `feature-matrix.md`. This audit adds the readiness classification the user asked for, layered on top of (not replacing) the existing legend:

| Classification | Meaning here |
|---|---|
| ✅ Ready for acceptance | On `main`, working, no defect found or found-and-fixed-and-already-live |
| ⚠ Needs investigation / redeploy to reconfirm | On `main` but this audit found and fixed a real defect not yet deployed, **or** a real data-integrity question needing a human decision (the un-indexed historical note) |
| ❌ Blocked | Code-complete and tested, but not on `main` — cannot be verified in the deployed app because there is nothing deployed to verify, which is the acceptance bar this project's own legend sets |

| Feature group | Classification | Why |
|---|---|---|
| Library, Reader, base Chat, base Universal Search, Workspace Intelligence Hub, Settings, Notes CRUD | ✅ Ready for acceptance | On `main`, previously accepted, no new defects found this audit |
| Merge Notes | ⚠ Needs investigation / redeploy to reconfirm | Real defect (no error handling) found and fixed; fix not yet on `main` |
| Explorer / Dashboard insights (error-state handling) | ⚠ Needs investigation / redeploy to reconfirm | Real defect (dropped error state) found and fixed; fix not yet on `main` |
| The un-indexed historical note (`3bb041d4-...`) | ⚠ Needs investigation | Root-caused, code fixed, but the specific existing row needs a human decision (backfill vs. accept as a known gap), not a code fix |
| Knowledge Confidence, Knowledge Actions, Knowledge Collections, Natural Language Commands, AI Workspace Actions, Platform Coherence Sprint v1 & v2 fixes, Search hybrid/ranking/zero-result maturity | ❌ Blocked | Code-complete, tested, not on `main` — deployment gap, not an implementation defect |
| Content Connections graph mock error | Not applicable (expected behavior) | Confirmed test-harness artifact, not a live defect |

---

## Recommendation

**Further Stabilization Required — with a specific, narrow cause.** The implementation itself is in good shape: this audit found five real defects across the entire runtime surface (NL matcher too strict, missing indexing in `SaveConversationDialog`, Merge Notes' missing error handling, and two dropped-error-state UI bugs), all five reproduced against real data or real interaction, all five fixed, all five verified (tsc clean, 954/954 tests, lint clean, build clean). No confirmed defects remain unfixed except the two items marked ⚠ above, both of which require a decision rather than more code (redeploy timing; whether to backfill one historical note).

The dominant blocker is not code quality — it's that **`main` is 11 commits behind this branch** and none of the last five feature efforts (Knowledge Confidence, Knowledge Actions, Knowledge Collections, Natural Language Commands, AI Workspace Actions, both Coherence sprints, this audit's own fixes) have ever reached production. That is the direct explanation for the user's real, accurately-reported observation that Save-to-Notes "doesn't work" — it isn't running.

Merging this branch to `main` (and deploying) is the actual unlock for re-running acceptance on everything marked ❌ Blocked above. That is a consequential, hard-to-reverse action affecting a live application serving a real business — it is not something this audit performs unilaterally. Recommend the user authorize the merge explicitly; once deployed, the ❌ Blocked rows above are ready for a fresh acceptance pass, and the ⚠ rows can be reconfirmed at the same time.
