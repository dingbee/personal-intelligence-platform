# ARRIYIA Rebranding & Migration — Forensic Audit

Post-10/10, Phase 1. **Read-only.** No source file, configuration, database, or deployment was modified while producing this document — this file itself is the only change made during this phase. Baseline: `dingbee/personal-intelligence-platform` @ `main`, release commit `c3a9ebf81884afbf8ae97bc01356151f15b963c7`, working tree clean at the start and end of this audit.

Approved architecture this audit measures against:

```
NOLMARK (company) → NOVA (intelligence infrastructure) → ARRIYIA Personal AI (public product) | Mtoni OS | Future
```

ARRIYIA is the public brand. NOVA is retained where it genuinely names underlying intelligence infrastructure. Nothing here assumes a blind global replace.

## 1. Repository Identity

| Field | Value |
|---|---|
| Repository | `dingbee/personal-intelligence-platform` (`git remote -v` confirmed) |
| Branch | `main` |
| HEAD | `c3a9ebf81884afbf8ae97bc01356151f15b963c7` |
| Working tree | Clean |
| Package name | `personal-intelligence-platform` (`package.json`) |
| Framework | React 19 + Vite 8 + TypeScript, Tailwind CSS 4 |
| Build system | `tsc -b && vite build`, `oxlint`, `vitest` |
| Deployment | Vercel — `vercel.json` is a bare SPA catch-all rewrite, **no name, domain, or project identifier of any kind in the file** |
| Supabase | Project `uzshazetfkjkrdnxwjtl`, referenced only via `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env vars — no project ref hardcoded in source |
| Public application title | **"Second Brain"** — both the static `index.html` `<title>` and the runtime `document.title` (see §4) |
| README identity | Opens `# Second Brain` |

**Current product identity is "Second Brain."** Not "NOVA PIP," not "PIP," not "ARRIYIA" — this is worth stating plainly since several historical docs (including the manual) refer to the product as "NOVA PIP," but the actual shipped, user-visible product title is "Second Brain." The rebrand target is therefore a two-step conceptual move (Second Brain → ARRIYIA), not a one-step move from an already-shipped "NOVA PIP" identity.

## 2-3. Identity Term Census & Classification

Raw file-level hit counts (tracked source, case-insensitive):

| Term | Files |
|---|---|
| `NOVA` (any case) | 193 |
| `PIP` (word-boundary) | 94 |
| `Second Brain` | 4 (`README.md`, `index.html`, `src/app/appConfig.ts`, plus `dist/` build artifacts — not source) |
| `ARRIYIA` (any case) | 26 |
| `Personal Intelligence Platform` (full phrase) | 3 |

These counts alone are not the finding — the classification is. Full matrix (representative rows; exhaustive for anything HIGH/CRITICAL, sampled for the hundreds of comment-only occurrences):

| Reference | File(s) | Location | Category | Current Meaning | Action |
|---|---|---|---|---|---|
| `appConfig.productName = 'Second Brain'` | `src/app/appConfig.ts` | runtime, single seam | PUBLIC_BRAND / PRODUCT_CONFIG | The one place the product name is defined | **REPLACE** (single line) |
| `document.title = appConfig.productName` | `src/app/App.tsx:21` | runtime | PRODUCT_CONFIG | Browser tab title, driven dynamically | RETAIN mechanism, value updates automatically once appConfig changes |
| `{appConfig.productName}` | `src/shared/components/layout/Sidebar.tsx:37` | UI | USER_FACING | Sidebar brand label | RETAIN mechanism, updates automatically |
| `<title>Second Brain</title>` | `index.html` | static HTML, pre-hydration | PUBLIC_BRAND | SEO/pre-JS fallback title, **not** wired to appConfig | **REPLACE manually** — this is a second, independent copy |
| `# Second Brain` | `README.md` | docs | DOCUMENTATION | Repo README heading | REPLACE (or REVIEW if README should stay dev-internal) |
| `NOVA_IDENTITY.name = 'NOVA'` | `src/modules/intelligence/personality/novaPersonality.ts` | runtime, feeds the LLM system prompt via `buildPersonalityPrompt()` | NOVA_INFRASTRUCTURE / PRODUCT_CONFIG (dual nature — see §7) | What the model is told to call itself | **REVIEW — human decision required**, single seam if changed |
| Literal `"NOVA"` JSX text (`NovaStatusIndicator`, `HowNovaUsesThisSection`, memory badges, insight drawer, command bar, ~10 components) | 40 `.tsx` files (see §4) | UI | USER_FACING | Assistant name shown throughout the product | **REVIEW — human decision required**, NOT a single seam (copy-pasted independently in every component) |
| `NovaInsightDrawer`, `NovaCommandBar`, `NovaSuggestions`, `NovaContextUsedBadges`, `NovaStatusIndicator`, `buildNovaContextPrompt`, `NovaContext` type | ~10 files | code identifiers (component/function/type names) | TECHNICAL_IDENTIFIER | Internal naming, invisible to users | RETAIN or RENAME LATER — cosmetic-only risk, no external contract |
| "PIP Sprint N/10 — ..." comments | ~85 files across `src/` | code comments | HISTORICAL | Development provenance record | **RETAIN** — see §9 |
| `arriyiaArticle.ts` fixture, `documentIntelligence.arriyia.test.ts`, and 3 production code comments referencing "the ARRIYIA-in-article retrieval failure" | 4 files | test fixture / code comment | TEST_FIXTURE / HISTORICAL | A fictional company name used in a Sprint 4/10 bug-repro fixture — coincidentally identical to the new brand name | **RETAIN, do not rename** — see §13 |
| `docs/pip-*.md` filenames (13 files) | `docs/` | documentation | HISTORICAL | Sprint/discovery doc filenames | RETAIN filenames (historical record); optionally relabel titles inside — see §9 |
| "NOVA beta" / "on NOVA" in transactional email copy | `supabase/functions/send-beta-invitation/index.ts`, `send-workspace-invitation/index.ts` | **live, external, user-received email** | PUBLIC_BRAND / USER_FACING | Real invitation emails sent to real people today | **REPLACE — highest external visibility of any item in this audit** |
| `docs/manual/README.md`: "NOVA is your Personal Intelligence Platform (PIP)" | `docs/manual/` | documentation, not linked from the app | DOCUMENTATION / USER_FACING (offline) | Manual's own opening definition | REPLACE, not urgent (not in-app-linked) |
| `supabase/functions/{ai-chat,delete-account,provider-availability,send-beta-invitation,send-workspace-invitation}` | edge function slugs | DEPLOYMENT | TECHNICAL_IDENTIFIER | Function names, part of the URL path (`/functions/v1/<slug>`) | **RETAIN — INTERNAL COMPATIBILITY** (see §7) |
| `pipeline` directory names (`src/modules/assets/pipeline`, `src/modules/processing/pipeline`) | 2 dirs | code | **NOT A MATCH** | The English word "pipeline," unrelated to the "PIP" acronym | RETAIN — false positive, noted so it isn't mistaken for a real hit |
| Third-party domains (`api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `api.resend.com`, `*.supabase.co`) | edge functions | THIRD_PARTY | Provider APIs | RETAIN — unrelated to product identity |
| Migrations (`0001`-`0040`) | `supabase/migrations/*.sql` | SUPABASE | — | **Zero** NOVA/PIP/ARRIYIA in any table, column, function, enum, or policy name — the one hit is a comment header (`-- PIP Sprint 9/10`) | RETAIN |
| Env var names | `.env`, `.env.example`, edge functions | PRODUCT_CONFIG | — | **Zero** `NOVA_*`/`PIP_*` env vars anywhere; only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_FROM_EMAIL`, `SITE_URL` | RETAIN |
| `pip*`-prefixed code identifiers (`pipService`, `pipEngine`, `pipConfig`, etc., as hypothesized in the audit brief) | — | TECHNICAL_IDENTIFIER | **Does not exist.** Searched exhaustively; "PIP" is never used as a code-naming prefix anywhere in this codebase, only as prose in comments | N/A — Phase 6's premise doesn't apply here |

## 4. Public Identity Surfaces

Every `.tsx` file with a NOVA/PIP/Second Brain reference was inspected to separate literal rendered text from component/prop names that never reach the screen.

**Confirmed rendered to the user today:**
- **"Second Brain"** — browser tab title (dynamic, via `appConfig.productName`) and sidebar brand label (same source).
- **"NOVA"** — extensively, as the AI assistant's name: status indicator badge, "How NOVA uses this information" memory-disclosure section, insight drawer titles, command bar, suggestion cards, "used by NOVA" memory badges, knowledge-gap copy ("NOVA's best guess..."), export dialogs, reader chat panel, settings pages, growth/recommendation sections. 40 `.tsx` files total; ~60 literal rendered-text occurrences of the word "NOVA" counted via a heuristic pass (`>NOVA<`, `NOVA'`, `NOVA `, etc.), concentrated in `src/modules/intelligence/`, `src/modules/ai/memory/`, `src/modules/commands/`, and `src/modules/hub/`.
- **"NOVA beta" / "on NOVA"** — live transactional email subject lines and body copy (beta invitation, workspace invitation).

**Confirmed NOT reaching the user:**
- **"PIP"** — checked every `.tsx` file for literal JSX text; every single occurrence is a `//` or `/* */` code comment. PIP never appears as rendered UI text anywhere in the running application.
- **"ARRIYIA"** — confirmed in §13, test/fixture-only in source.

Login, signup, onboarding, password reset, and account-deletion screens were specifically checked (`AuthContext.tsx`, `LoginPage.tsx`, `DeleteAccountCard.tsx`, and the invitation/beta email builders) — none hardcode "Second Brain" directly (they inherit it via `appConfig`/browser title where relevant); the one exception is the email templates, already flagged above as the highest-visibility item.

## 5. Brand Architecture — NOVA Classification

Per the approved architecture, NOVA references split cleanly into two groups with different treatment:

**A. Product branding / assistant identity (requires a human decision, not infrastructure):**
- `NOVA_IDENTITY.name` in `novaPersonality.ts` — literally what the model is instructed to call itself in every chat turn. This is a single constant (excellent — a one-line change if the decision is made), but it is conceptually a brand decision, not an infrastructure one.
- The ~40-file UI surface in §4 — the assistant's name as the user actually sees it. **Not currently centralized** (no shared constant these components import); each hardcodes the literal string.
- The email copy in §4.

This audit does **not** decide whether the assistant becomes "ARRIYIA," "Ask ARRIYIA," or keeps "NOVA" as an in-product persona name distinct from the outer "ARRIYIA" product brand (the way, e.g., a company brand and a chatbot's given name can legitimately differ). That is exactly the kind of product decision Phase 17 of the originating task correctly reserves for the human owner. Flagged, not decided.

**B. Intelligence infrastructure (candidate for retention as "NOVA"):**
- No orchestration engine, service, or class is literally named `Nova*` at the infrastructure layer — `AIService`, `retrieveContext`, `buildSystemPrompt`, the provider-chain/fallback system, the embedding pipeline, and the retrieval/memory/graph modules all use neutral, non-branded names already (`AIService`, not `NovaService`; `retrieveContext`, not `NovaRetrieval`). The one exception is `resolveNovaContext`/`NovaContext` (types in `src/modules/intelligence/context/types.ts`, called from `AIService.ts:226`), which composes the "Explain My Answer" reasoning-trace data structure — this is UI-support plumbing (feeds `NovaContextUsedBadges`/`NovaInsightDrawer`), not core runtime infrastructure, so it belongs with group A's UI surface, not group B.
- **Net finding: this codebase has almost no "NOVA-branded infrastructure" to retain in the sense the architecture diagram anticipates.** The runtime/orchestration layer was already built with neutral names. What exists under "NOVA" is overwhelmingly product/assistant identity (group A), which is exactly what a rebrand decision is supposed to be about — there isn't a large body of infrastructure code whose renaming would be a mistake. This simplifies the migration: there's no meaningful "protect the infrastructure from an overzealous rename" risk here, because the infrastructure never took the NOVA name to begin with.

## 6. Technical Identifiers Requiring Review

As established in §3: there are no `pip*`-prefixed identifiers anywhere. The technical-identifier review that matters is the `Nova*`-prefixed set:

| Identifier | Referenced across | Persistence/API/URL contract? | Recommendation |
|---|---|---|---|
| `NovaInsightDrawer`, `NovaCommandBar`, `NovaSuggestions`, `NovaContextUsedBadges`, `NovaStatusIndicator` (component names) | Each imported by 1-3 parent components | No — internal React component names | RENAME LATER (cosmetic, zero external contract, but touches import statements in ~15 files — real but low-risk work) |
| `buildNovaContextPrompt`, `NovaContext`, `resolveNovaContext` | `AIService.ts` + `intelligence/` module | No | RENAME LATER, same reasoning |
| `novaPersonality.ts`, `NOVA_IDENTITY`, `NOVA_TRAITS`, `NOVA_AVOIDANCES`, `buildPersonalityPrompt` | `AIService.ts` (1 call site) | No, but the **content** it produces is sent to the LLM as the system prompt | DEPRECATE/RENAME together with the §5A product decision — this file should change in lockstep with whatever the assistant's identity decision is, not independently |

None of these appear in persistence (no DB column/table named after them), no RPC, no public API contract, no URL. All are safe to leave alone indefinitely if the product decision is "keep the assistant called NOVA under the ARRIYIA product umbrella" — in which case **none of this needs to change at all**, which is a legitimate outcome this audit is explicitly supposed to allow for.

## 7. Supabase / Database Implications

**Confirmed clean.** Every migration (`0001`-`0040`) was searched for NOVA/PIP/ARRIYIA in table names, column names, enum values, function/RPC names, trigger names, and policy names. The only hit across all 40 files is a single comment header (`-- PIP Sprint 9/10 (Performance & Scale Validation).` in `0040_performance_indexes.sql`) — a historical-record comment, not a schema identifier.

Edge Function slugs (`ai-chat`, `delete-account`, `provider-availability`, `send-beta-invitation`, `send-workspace-invitation`) contain no product-name text and are part of a stable API contract (`https://<project-ref>.supabase.co/functions/v1/<slug>`) that the deployed frontend calls by exact string match. **RETAIN — INTERNAL COMPATIBILITY.** There is no cosmetic reason to touch these, and doing so would require simultaneous, carefully-sequenced client + redeploy changes for zero user-visible benefit (function slugs are never shown to users).

No Storage bucket (`documents`, `assets`) is named after the product. No auth configuration, RLS policy, or SECURITY DEFINER function references NOVA/PIP/ARRIYIA. **The database and Supabase configuration require zero changes for this rebrand.**

## 8. Deployment / Domain Implications

- `vercel.json` contains no name, domain, or project reference — genuinely cannot break from a text rename.
- No `.vercel/` project config is committed (expected — that binding lives in Vercel's own dashboard, tied to the GitHub repo, not to any file here).
- **No domain is hardcoded anywhere in source.** Every redirect URL (`emailRedirectTo`, password-reset, invitation accept links) is built from `window.location.origin` (client-side) or a `SITE_URL` environment variable with a same-request `Origin` header fallback (edge-function-side). This means: **a domain change requires zero code changes** — only updating the `SITE_URL` secret (if set) and Vercel's own domain configuration, both external to this repository.
- Package name (`personal-intelligence-platform`) is npm-internal only; nothing in the repo ties it to the Vercel project identity.

**What must actually change outside this repo when ARRIYIA goes live**: the Vercel project's custom domain (if a new one is desired), the `SITE_URL` Supabase secret (if currently set to a Second-Brain-era domain), and whatever the human owner decides about `RESEND_FROM_EMAIL` (currently unset in visible config, defaulting to Resend's own `onboarding@resend.dev` sandbox sender — there is no existing branded email identity to migrate away from; a branded `@arriyia...` sender would be new setup, not a migration).

## 9. Documentation Implications

Three tiers, matching the audit brief's own example distinction:

1. **Current product documentation** (should eventually read ARRIYIA): `README.md`, `docs/manual/*` (8 chapters + README), `docs/feature-matrix.md`'s legend/intro prose, `docs/pip-release-scope-v1.md`, `docs/arriyia-personal-release-backlog.md` (already ARRIYIA-forward), `docs/arriyia-product-roadmap.md` (already ARRIYIA-forward), `docs/account-deletion-data-map.md`, `docs/pip-final-platform-validation-v1.md`.
2. **Technical/infrastructure documentation**: comments inside `novaPersonality.ts`, `AIService.ts`, and similar — may retain NOVA terminology where it genuinely describes the intelligence layer, pending the §5A decision.
3. **Historical sprint records**: the ~13 `docs/pip-*.md` filenames and the "PIP Sprint N/10" title convention used inside `docs/feature-matrix.md` and every sprint's own `.md` file. **These should NOT be retitled "ARRIYIA Sprint N/10"** — they are dated, historically-accurate development records of what was actually built and when, under the name the project actually had at the time. Renaming them would falsify the historical record for no user-facing benefit (none of this is ever shown to an end user). Same treatment as the ~85 in-code "PIP Sprint N/10" comments in §3 — **RETAIN**, full stop, not merely deprioritized.

## 10. Deployment/Domain — see §8 (merged, no additional findings).

## 11. Authentication / Email Identity

- Auth redirect URLs (`emailRedirectTo`, password-reset `redirectTo`) are Supabase Auth's own mechanism — they redirect back into the app at whatever `window.location.origin` was at request time, meaning **magic links generated before a domain change remain valid and functional after one**, as long as the old domain still resolves (or a redirect is put in place — see §14). No code change needed for this to keep working.
- The two branded transactional emails (beta invite, workspace invite) are the single highest-visibility PUBLIC_BRAND item in this entire audit — real people receive "You've been invited to the NOVA beta" today. This is a small, contained, HIGH-priority (not CRITICAL — it's copy text, not a security boundary) item for Phase 2.
- No sender email address is hardcoded to a Second-Brain-branded domain; `RESEND_FROM_EMAIL` is an unset-by-default env var falling back to Resend's own sandbox address. There is nothing to "migrate away from" here — only a future decision about whether to configure a branded sender.

## 12. Domain Strategy (documentation only, per this phase's rules)

Known facts, no action taken or recommended beyond recording them:
- No production domain reference exists in this repository at all (confirmed §8) — the current production domain, whatever it is, lives entirely in Vercel's dashboard configuration, not in code.
- A future ARRIYIA domain, once chosen, needs: (a) Vercel domain configuration (external), (b) the `SITE_URL` Supabase secret updated if it's currently set to a domain-specific value (this repo cannot determine its current value — it's an edge-function secret, not committed), (c) Supabase Auth's allowed redirect URLs list (external, Supabase dashboard) updated to include the new domain, (d) nothing in application code.
- Email domain: no branded sender currently configured; a future `@arriyia`-style sender is new setup, not migration.

## 13. Test-Fixture Exceptions

Confirmed, exhaustively:

| File | What it is | Classification |
|---|---|---|
| `src/modules/ai/orchestration/__fixtures__/arriyiaArticle.ts` | A fictional company profile used as bug-repro test content for Sprint 4/10's real retrieval defect (a document mentioning a company literally named "ARRIYIA" that the model failed to answer questions about) | **TEST DATA — RETAIN, do not rename** |
| `src/modules/ai/orchestration/documentIntelligence.arriyia.test.ts` | Test file exercising the same fixture | TEST DATA — RETAIN |
| `src/modules/ai/orchestration/extractLexicalSearchTerms.ts` (comment) | Production code comment: *"root cause of the ARRIYIA [retrieval failure]"* | HISTORICAL comment, RETAIN |
| `src/modules/ai/orchestration/AIService.ts:178` (comment) | *"...ARRIYIA connected to?") deserves that entity's real graph evidence"* — an example query in a comment | HISTORICAL comment, RETAIN |
| `src/modules/knowledge-intelligence/api/retrieveNamedEntityGraphContext.ts` (comment) | Same example query pattern | HISTORICAL comment, RETAIN |

This is purely coincidental: "ARRIYIA" was chosen as a plausible fictional company name for a bug-repro fixture in Sprint 4/10, long before the brand decision was made. Renaming or removing it would (a) provide no product benefit — it's never shown to a user, (b) require re-validating that the retrieval fix it exercises still behaves identically under a new fixture name, a pure-cost, zero-benefit change, and (c) actually make the bug's own historical name confusing (the fix is *for* "the ARRIYIA-in-article failure" — that name is now doubly appropriate, if anything). **Explicitly excluded from the rebrand.**

## 14. Risk Matrix

Scored per the audit's own four-tier scale. Only HIGH/CRITICAL items get the full Risk/Impact/Probability/Mitigation/Rollback treatment; LOW/MEDIUM are listed with a one-line reason.

### CRITICAL
**None identified.** No item in this audit touches authentication mechanics, data persistence, or a security boundary. The closest candidate — auth redirect URLs — was confirmed domain-agnostic by construction (§11), so a domain change doesn't break auth; it only requires the external Supabase/Vercel configuration steps in §12.

### HIGH
| Item | Risk | Impact | Probability | Mitigation | Rollback |
|---|---|---|---|---|---|
| Transactional email copy ("NOVA beta") | Real users receive branding mid-transition if emails aren't updated in the same window as the UI | Confusing but non-breaking — the link still works regardless of the subject line | Certain, if this item is simply forgotten during Phase 2 | Update both edge functions' copy in the same PR as the UI identity change, not separately | Revert the two files; no data implication |
| `appConfig.productName` change without also updating `index.html`'s static `<title>` | Two sources of truth (§3) — changing one without the other leaves a stale pre-hydration title (SEO snippets, browser history entries, share previews before JS loads) showing the old name | Cosmetic, not functional | High, if treated as "just edit appConfig" | Explicitly pair these two edits in the same commit | Trivial text revert |
| `NOVA_IDENTITY.name` change without the ~40-file UI surface, or vice versa | The model would introduce itself with one name while the UI badges show another | User-visible incoherence, not a functional break | High, if the §5A decision isn't made explicit before either is touched | Resolve the §5A product decision first, then change both together | Trivial text revert, no data implication |

### MEDIUM
- README/manual retitling — internal-facing, no user impact if delayed; JSX/UI copy replacement across ~40 files — mechanical but must be reviewed per-file (not blind replace, since some `NOVA` occurrences are component *names*, not display text) — real work, no structural risk.
- `Nova*`-prefixed code identifiers (§6) — cosmetic, contained refactor, no external contract.

### LOW
- `docs/pip-*.md` filenames, in-code "PIP Sprint N/10" comments — recommended RETAIN, not a migration item at all (§9).
- Test fixtures (§13) — recommended RETAIN, not a migration item at all.
- Third-party domains, Supabase/DB identifiers, edge function slugs — confirmed zero-touch (§7).

## 15. Recommended Migration Sequence

The proposed 13-step generic order from the task brief is broadly sound for this repository, with one adjustment justified by the evidence above: **the §5A product decision (does the assistant's in-app name change, and to what) must be resolved before any UI-copy or `NOVA_IDENTITY` edit begins**, because — unlike `appConfig.productName`, which has one seam — the assistant-identity surface has no seam and touching ~40 files twice (once with a guess, again after the real decision) is pure waste. Adjusted order:

1. Release baseline — **done** (`c3a9ebf`, this audit).
2. **Product identity decisions** (human-owner input, not implementation): confirm the exact ARRIYIA product name/tagline; decide the §5A assistant-identity question (does NOVA persist as the assistant's given name under the ARRIYIA umbrella, or does the assistant itself become "ARRIYIA"/"Ask ARRIYIA"). Nothing below can proceed correctly without this.
3. `appConfig.productName`/`productSubtitle`/`tagline` update (single seam) + `index.html`'s static `<title>` (paired edit, §14).
4. Assistant-identity implementation: `NOVA_IDENTITY` (if changing) + the ~40-file UI surface, done together per §14's HIGH item.
5. Transactional email copy (both edge functions) — same window as step 4, not deferred.
6. Metadata: none currently exists to update (no OG/manifest tags present — optionally add them as new work, not a migration item).
7. Domain/deployment: external Vercel + Supabase dashboard configuration, no code changes required (§8, §12).
8. Technical identifiers (`Nova*` component/function names) — cosmetic, do last, lowest urgency.
9. Documentation: current-product docs (§9 tier 1) updated; historical sprint records and `docs/pip-*.md` filenames explicitly left alone.
10. Repository cleanup — none identified as necessary by this audit; skip unless something turns up during implementation.
11. Full regression (`tsc -b`, `vitest run`, `oxlint`, `vite build`) — note: changing ~40 UI files' literal text plus `novaPersonality.ts` will require updating any test that asserts on that exact text (e.g., `novaPersonality.test.ts`, `buildNovaContextPrompt.test.ts`) — budget for this, it is real, expected work, not a regression.
12. Final ARRIYIA release candidate.
13. Production freeze.

## 16. Freeze Interaction

**Brand migration changes** (in scope for Phase 2, per this audit): every item in §3-§14 above.

**Functional product changes** (explicitly out of scope, would require separate authorization): none of the findings in this audit require a behavior change to qualify as "done" — every recommended action is a text/identifier/copy change, not a feature change. The one item that could be mistaken for a functional change — deciding whether the assistant's persona/tone (`NOVA_TRAITS`/`NOVA_AVOIDANCES`) should change alongside its *name* — is flagged explicitly: **renaming the assistant is a brand change; altering its personality traits is a functional/product-behavior change.** This audit found no evidence anyone has proposed changing the traits themselves, only the name — if Phase 2 implementation is tempted to "refresh NOVA's personality while we're in the file anyway," that is scope creep beyond a rebrand and should be flagged separately for its own approval, exactly as this task's own rules require.

## 17. Final Deliverable

This document, `docs/arriyia-rebranding-forensic-audit.md`, is the only file created during this phase.
