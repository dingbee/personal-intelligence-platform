# PIP Stabilization & Intelligence Integration v1

Not a new intelligence capability. This milestone makes three pieces of already-built intelligence (Multimodal Intelligence v1/v2, the beta invite/admin infrastructure, the existing responsive layout system) reliable and reachable in the real user experience. Full read-only discovery precedes this document — see `docs/pip-stabilization-intelligence-integration-discovery.md` for the complete lifecycle trace, root-cause table, and ranked mobile risk list. This document covers Phase 2 (Reconciliation) through Phase 9 (commit).

---

## Phase 2 — Reconciliation

### Issue 1: P0 — Image → Chat Intelligence Integration

- **Observed behavior.** A user uploads a photo with handwritten notes, then asks NOVA about it in Chat. NOVA responds that it has no information about "an image with the identifier '1000552373'" and asks the user to re-upload.
- **Expected behavior.** The user should be able to say "Explain these handwritten notes" or "What did I write about the marketing plan?" and NOVA should use the image's analyzed content automatically, without ever surfacing the internal asset id.
- **Existing implementation.** Multimodal Intelligence v1/v2's full pipeline — `analyzeImage`, `runKnowledgeExtractionFromContent`, `asset_embeddings`/`match_assets`, `assetSearchProvider` — all work correctly once triggered. The break is entirely in the Asset → Chat Context transition, exactly as the milestone's own hint anticipated.
- **Root cause (four, compounding — see discovery doc for full trace).**
  - A: `retrieveContext` (chat's only RAG source) is hardcoded to `match_document_chunks`, structurally blind to `asset_embeddings`.
  - B: `retrieveGraphContext` filters `knowledge_node_sources.source_type = 'document'`, structurally blind to asset-sourced knowledge nodes.
  - C: `ImageReaderPage`'s "Ask NOVA about this image" seeds the conversation with only the asset's (often filename-derived) title, never analyzed content.
  - D: Vision analysis is 100% manual (one button, one page) — a fresh upload has no description, text, or embeddings until a user finds and clicks "Analyze with NOVA."
- **Required change.** Extend chat's retrieval layer to also query `match_assets` and asset-sourced knowledge nodes (reusing the existing RPCs/tables, not building new ones); give the image chat entry point an honest, content-carrying seed message; auto-trigger analysis on upload, fire-and-forget.
- **Risk.** Retrieval changes touch the RAG path every chat message goes through — mitigated by keeping the new `AssetContextMatch[]` type and `<visual_context>` prompt block fully additive/parallel to the existing document-chunk path, never modifying `VectorMatch`, `resolveReferences`, or `context_chunk_ids` persistence.
- **Acceptance test.** See "Image Intelligence Acceptance Test" below.

### Issue 2: P1 — Beta Invite Email Delivery

- **Observed behavior.** Founder/Admin creates a beta invite; the invited person never receives an email.
- **Expected behavior.** Creating an invite triggers a real email to the invitee with a working accept link.
- **Existing implementation.** `beta_invites`, RLS, `enforce_beta_invite_gate()`, and every admin RPC already work correctly and are unmodified by this fix. `send-workspace-invitation` is a complete, working, security-reviewed edge function solving the identical problem for a different invite type.
- **Root cause.** Invite creation (`admin_create_beta_invite`) has only ever performed one `insert into beta_invites` — no trigger, no follow-up call, no edge function for beta invites ever existed.
- **Required change.** A new `send-beta-invitation` edge function mirroring `send-workspace-invitation`'s exact trust boundary and Resend integration, wired to fire after invite creation, with distinct UI feedback for "invite created" vs. "email delivery failed."
- **Risk.** Low — this function only ever reads `beta_invites` (never writes it), so a delivery failure of any kind leaves the invite row's `status` untouched; creation and delivery stay two independently-reportable facts.
- **Acceptance test.** See "Beta Invite Acceptance Test" below.

### Issue 3: P1 — iPhone / Mobile UI

- **Observed behavior.** Reported broken/unusable UI on iPhone, no specifics given.
- **Expected behavior.** Core surfaces (Chat, Reader, Image Reader, dialogs) render and function correctly on notched iPhones with on-screen keyboard and browser chrome.
- **Existing implementation.** The codebase was uniformly `100vh`/`h-screen` with zero `dvh`/`env(safe-area-inset-*)` usage anywhere — virgin territory, not a competing-pattern inconsistency.
- **Root cause (ranked, see discovery doc §"P1 — iPhone").** `ChatPage.tsx`'s `h-[calc(100vh-3.5rem)]` assumed a `TopBar` height that was never true; `ImageReaderPage`'s default image sizing forced horizontal scroll on nearly every photo; header button clusters had no overflow safety net; no `env(safe-area-inset-bottom)` anywhere; `Dialog.tsx` relied on implicit UA height-clamping.
- **Required change.** Fix the underlying layout system, not add device-specific hacks: replace the mismatched height calc with `h-full` (self-correcting via the existing flexbox chain); add `dvh` as a progressive-enhancement fallback alongside every `h-screen`/`min-h-screen`; default images to fit-within-container; add `overflow-x-auto` safety to header button clusters; add `env(safe-area-inset-bottom)` to bottom-of-screen UI; add `viewport-fit=cover` so those insets resolve to real values; give `Dialog` an explicit `max-h-[85dvh] overflow-y-auto`.
- **Risk.** Very low — every change is additive/progressive-enhancement (an `h-dvh` class after `h-screen`, `env()` inside `calc()`, an extra `overflow-x-auto`) with the original behavior as the fallback on any browser that doesn't support the newer CSS.
- **Acceptance test.** MANUAL VERIFICATION REQUIRED on a physical iPhone or accurate simulator — see the manual QA checklist below.

---

## Phase 3 — P0 Fix: Image → Chat Intelligence Integration

All four root causes fixed together, since the milestone's own expected flow only holds once all four hold.

- **`src/modules/ai/orchestration/retrieveAssetContext.ts`** (new) — embeds the query, calls the existing `match_assets` RPC, fetches title + metadata for matches, filters out unanalyzed assets (`metadata: null`) rather than fabricating content, and formats each match via `buildAssetContextContent.ts` (new) — a pure serializer that surfaces title, description, extracted text + language, and any `documentIntelligence` (dates/decisions/tasks), with an explicit low-confidence caveat sentence when self-reported confidence is below 0.5 for any dimension. Never invents a section that isn't present.
- **`src/modules/knowledge-intelligence/api/retrieveGraphContext.ts`** — gained an optional `assetIds` param; now runs two parallel `knowledge_node_sources` queries (one per `source_type`) and two parallel title-lookup queries (`documents` + `assets`), merging both. `buildGraphContextText` (the tested pure function) is untouched.
- **`src/modules/ai/orchestration/buildSystemPrompt.ts`** — gained an optional 5th `assetMatches` param; renders a new `<visual_context>` block, evidence-first (before `<knowledge_connections>`), only when matches exist. Fully backward-compatible — every existing call site is unaffected.
- **`src/modules/ai/orchestration/AIService.ts`** — `sendMessage` now also calls `retrieveAssetContext` (never-throws, `.catch(() => [])`), passes `assetIds` into `retrieveGraphContext`, and passes `assetMatches` into `buildSystemPrompt`. `buildContextTrace`'s own signature is unchanged — only its `matches.length` argument now includes asset matches too.
- **`src/modules/assets/intelligence/buildImageChatSeedQuery.ts`** (new) — replaces `ImageReaderPage`'s bare-title seed message. Returns an honest "NOVA hasn't analyzed it yet" seed for an unanalyzed image; otherwise carries the real description and any extracted text into the very first chat turn.
- **`src/modules/assets/hooks/useAssets.ts`** — the `upload` mutation now fires `useAnalyzeImage` automatically, fire-and-forget, immediately after a successful upload (same "never block the UI, swallow own errors" contract `indexAsset`/`indexNote`/`autoReconcileNewKnowledge` already follow).

**Why no new intelligence engine was created.** Every fix reuses existing infrastructure exactly: the `match_assets` RPC (Multimodal v2/KIL v1), the existing `AssetAnalysis`/`DocumentIntelligence` types, the existing `knowledge_node_sources` polymorphic `source_type`/`source_id` convention (extended to a type it already logically applied to but was never wired for), the existing `useAnalyzeImage` composition, and the existing tagged-prompt-block convention (`<knowledge_connections>`/`<personal_context>`/`<spreadsheet_analysis>`, now joined by `<visual_context>`).

**Why `VectorMatch` was not overloaded.** Asset matches flow through a separate, explicitly-typed `AssetContextMatch[]` rather than being stuffed into `VectorMatch`'s document-shaped `documentId`/`chunkId` fields — avoiding any risk to `resolveReferences`'s reference-chip resolution or `context_chunk_ids` persistence, both of which remain document-chunk-specific and untouched.

**Known, deferred UI-polish gap.** An asset match that can't be reference-chipped by the existing `resolveReferences` (which only knows about document chunks) is simply omitted from the UI's reference list rather than crashing or fabricating a chip — the underlying content still reaches the model via `<visual_context>`, only the clickable-reference-chip UI affordance is not yet extended to assets. Left for a future UX pass, not silently pretended away.

---

## Phase 4 — P1 Fix: Beta Invitation Email

- **`supabase/functions/send-beta-invitation/index.ts`** (new edge function, deployed) — mirrors `send-workspace-invitation`'s trust boundary exactly: the caller's own JWT authenticates via a plain anon-key client; authorization is re-checked via the existing `is_platform_admin()` RPC (not trusted from the client); only then does a service-role client perform the one RLS-blocked read of the invite row; the invite's `status` is re-verified against that fresh read (never trusted from the request body), so an already-accepted or revoked invite cannot be re-emailed. Sends via the same Resend HTTP API integration, reusing the already-configured `RESEND_API_KEY`/`RESEND_FROM_EMAIL`/`SITE_URL` secrets — no new secret setup. The accept link is `${SITE_URL}/signup?email=<invitee>` — no token needed, since acceptance is email-match based via the existing `enforce_beta_invite_gate()` trigger.
- **`src/modules/admin/api/adminApi.ts`** — new `sendBetaInvitationEmail(inviteId)`, mirroring `sendWorkspaceInvitationEmail`'s shape: takes only the id (never email/name, so the function re-resolves everything server-side), returns `{ error }` rather than throwing.
- **`src/modules/admin/hooks/useAdminData.ts`** — new `useAdminSendBetaInvitationEmail()` mutation hook, following the file's existing convention.
- **`src/modules/admin/pages/AdminDashboardPage.tsx`** — `handleCreateInvite` now calls `sendBetaInvitationEmail` after a successful `'created'` outcome and reports three distinct outcomes to the founder: invite created + email sent, invite created + email failed (with the specific error), or invite creation itself failed. A `'duplicate'` outcome never attempts a send. This directly satisfies the milestone's explicit instruction not to claim delivery is fixed merely because a database row exists.

**Security note.** No secret value was ever read, printed, or exposed in any tool output, code comment, or documentation while implementing this fix — only secret *names* (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SITE_URL`) and their configuration status are referenced. The edge function remains the only place email is sent from; the browser never talks to Resend directly.

---

## Phase 5 — P1 Fix: iPhone / Mobile UX

Every change below is additive/progressive-enhancement — the pre-existing behavior remains the fallback on any browser that doesn't support the newer CSS feature, and none of them special-case a device width or user agent.

| File | Change |
|---|---|
| `src/shared/components/layout/AppShell.tsx` | `h-screen` → `h-screen h-dvh` |
| `src/modules/ai/chat/pages/ChatPage.tsx` | `h-[calc(100vh-3.5rem)]` → `h-full` (the root fix: this now inherits the real remaining height from `AppShell`'s own flexbox chain instead of assuming a `TopBar` height that was never true) |
| `src/modules/assets/pages/ImageReaderPage.tsx` | `h-screen` → `h-screen h-dvh` (both occurrences); header button cluster gained `overflow-x-auto`; image now defaults to `maxWidth:'100%'`/`maxHeight:'100%'` fit-within-container at zoom 1, only switching to explicit native-pixel sizing when actually zoomed |
| `src/modules/reader/pages/ReaderPage.tsx` | `h-screen` → `h-screen h-dvh` (both occurrences); header button cluster gained `overflow-x-auto` |
| `src/modules/auth/ProtectedRoute.tsx`, `src/modules/admin/RequireAdmin.tsx`, `src/modules/auth/components/AuthCard.tsx` | loading/auth screens gained the same `dvh` fallback, for consistency |
| `index.html` | viewport meta gained `viewport-fit=cover` — required for `env(safe-area-inset-*)` to resolve to non-zero values at all |
| `src/modules/ai/chat/components/ChatInput.tsx` | bottom padding gained `pb-[max(1rem,env(safe-area-inset-bottom))]` |
| `src/modules/intelligence/components/InsightDrawerShell.tsx` | the minimized-state pill's fixed bottom offset gained `+ env(safe-area-inset-bottom)` at both breakpoints |
| `src/shared/components/ui/Dialog.tsx` | default dialog class gained `max-h-[85dvh] overflow-y-auto`, replacing reliance on the native `<dialog>` UA-stylesheet clamp |

**What was deliberately not touched**, per discovery's own findings: `EdgeDrawerDialog` (all three mobile drawers), `GraphCanvas`/`SpreadsheetGridView`/admin tables (`overflow-x-auto` already correct), `ReaderPage`'s `activePanel` mobile pattern, `NovaCommandBar`'s `h-full`/`inset-0` full-screen behavior — all confirmed already correct in discovery.

---

## Phase 6 — Regression Testing

Full verification gate run after all three fixes, on the whole repository (not just changed files):

- `npx tsc -b` — clean, zero errors.
- `npx vitest run` — **1701 of 1702 tests passing.** The one failure (`exportNotePackage.test.ts` › "the notePackageExporter object delegates to the same function") is a pre-existing timestamp-boundary flake unrelated to any change in this milestone — confirmed by re-running that file alone, which passed cleanly. No file touched by this milestone is involved in that test.
- `npx oxlint` — clean, zero warnings.
- `npx vite build` — succeeds (pre-existing chunk-size warnings only, unrelated to this milestone).

New/extended automated tests added by this milestone:

- `buildAssetContextContent.test.ts` (9 tests, new)
- `retrieveAssetContext` is exercised indirectly via `AIService.test.ts`'s new tests (below) — it has no pure logic of its own beyond composition, matching the untested-at-this-layer precedent already set by `indexNote`/`assetSearchProvider`.
- `buildSystemPrompt.test.ts` — 3 new tests (`<visual_context>` renders/omits correctly, ordering before `<knowledge_connections>`)
- `AIService.test.ts` — 4 new tests (asset match reaches the prompt, counts into `contextTrace`, flows into `retrieveGraphContext`'s `assetIds`, and a rejected `retrieveAssetContext` call still yields a normal successful response — the never-throws contract)
- `buildImageChatSeedQuery.test.ts` (4 tests, new)
- `adminApi.test.ts` — 3 new tests for `sendBetaInvitationEmail` (success, provider error surfaced as `{error}` not a throw, 409-style "no longer pending" surfaced the same way)

No test suite exists for CSS/layout changes (Phase 5) or edge-function Deno code (`send-beta-invitation`) in this repository — both are covered by manual verification only, consistent with how every prior edge function and CSS-only change in this codebase has been verified (see `docs/feature-matrix.md`'s existing "Tests" column for other edge-function rows).

---

## Phase 7 — Manual Verification Checklist

**Image Intelligence Acceptance Test** — requires a real test image containing handwritten notes with a date, a decision, a task, and free-form handwriting, and a live deployment with a working vision-capable provider configured.

1. **MANUAL VERIFICATION REQUIRED** — Path A (Upload → Analyze → Chat): upload the test image, confirm analysis fires automatically (no manual "Analyze with NOVA" click needed), then ask "Explain these handwritten notes" in a *new* Chat conversation (not opened from the image) and confirm NOVA responds with real content from the image, never an asset id.
2. **MANUAL VERIFICATION REQUIRED** — Path B (ImageReaderPage → Chat): from the image's own page, click "Ask NOVA about this image" and confirm the seeded first message contains real content (not just the filename-derived title).
3. **MANUAL VERIFICATION REQUIRED** — Path C (image-derived knowledge → Chat): ask a question naturally referencing something written in the image (e.g. the decision or task it contains) without mentioning "image" at all, and confirm NOVA answers using that content.
4. **MANUAL VERIFICATION REQUIRED** — Path D (Search → image → Chat): search for text known to be in the image via Universal Search, confirm the image surfaces as a result, then ask about it in Chat.
5. **MANUAL VERIFICATION REQUIRED** — Path E (existing conversation → follow-up): in an already-open conversation, ask a follow-up question about a previously-discussed image and confirm continuity.
6. **MANUAL VERIFICATION REQUIRED** — confirm the asset id (`1000552373`-style identifier) never appears anywhere in NOVA's responses across all five paths.
7. **MANUAL VERIFICATION REQUIRED** — confirm an image NOVA has not yet analyzed produces an honest "hasn't looked at this yet" response, never a fabricated description.
8. **MANUAL VERIFICATION REQUIRED** — confirm fallback routing (a secondary provider) still carries the same visual context if the primary provider is unavailable.
9. **MANUAL VERIFICATION REQUIRED** — confirm re-analyzing an image ("Re-analyze") updates what Chat can retrieve, not just what the Image Reader page displays.

**Beta Invite Acceptance Test**

10. **MANUAL VERIFICATION REQUIRED** — as Founder/Admin, create a beta invite for a real, reachable test email address; confirm the UI reports "invite created and invitation email sent," not just "invite created."
11. **MANUAL VERIFICATION REQUIRED** — confirm the test email address actually receives the invitation email (inbox check — a sent API call is not proof of receipt).
12. **MANUAL VERIFICATION REQUIRED** — click the accept link in the received email and confirm it lands on `/signup` with the email pre-filled, and that signup with that exact email succeeds (the beta gate accepts it).
13. **MANUAL VERIFICATION REQUIRED** — confirm signup with a *different*, uninvited email address is still blocked (regression check — this path was not touched by this fix).
14. **MANUAL VERIFICATION REQUIRED** — confirm `RESEND_API_KEY` is actually configured as a secret in this deployment; if it is not, the edge function will correctly report a 500 rather than silently failing, but the invite will not be delivered until it's set — this determination could not be made from source and needs an operator check.

**Mobile / iPhone Verification** (physical device or accurate simulator required)

15. **MANUAL VERIFICATION REQUIRED** — on an iPhone with a notch/Dynamic Island, confirm the Chat composer is fully visible and usable without scrolling, both with and without the on-screen keyboard open.
16. **MANUAL VERIFICATION REQUIRED** — confirm opening a photo in Image Reader shows the whole image fit to screen by default (no forced horizontal scroll), and that zooming still works.
17. **MANUAL VERIFICATION REQUIRED** — confirm Reader and Image Reader header button rows don't visually overflow or clip on a 375px-wide viewport.
18. **MANUAL VERIFICATION REQUIRED** — confirm no UI element is obscured by the home-indicator bar at the bottom of the screen.
19. **MANUAL VERIFICATION REQUIRED** — open a dialog (e.g. a Save As / Export dialog) with the on-screen keyboard active and confirm it remains fully scrollable/usable rather than being clipped.

---

## Phase 8 — Documentation

This document, `docs/pip-stabilization-intelligence-integration-discovery.md` (Phase 1, already complete), and `docs/feature-matrix.md` (new "PIP Stabilization & Intelligence Integration v1" section) constitute this milestone's full documentation. No engineering-blueprint update was needed — this milestone fixes integration gaps in already-documented systems rather than introducing new architecture.

## What remains / deferred

- The reference-chip UI gap for asset matches noted in Phase 3 (content reaches the model; the clickable-chip affordance doesn't yet extend to assets).
- Whether `RESEND_API_KEY` is actually configured in this deployment (manual item #14 above) — could not be determined from source, and this fix does not change that dependency.
- All 19 manual verification items above — none of them can be confirmed by an automated test in this codebase; they require a live deployment, real email delivery, and physical/simulated iPhone testing.
