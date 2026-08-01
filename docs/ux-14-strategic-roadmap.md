# NOVA PIP UX-14 Strategic Roadmap

**Status: strategic discovery only.** No code, schema, or UI changes were made to produce this document. It exists to be the blueprint before implementation begins, per explicit instruction.

**Guiding question:** How does NOVA move from an intelligent workspace that users operate, into an intelligence system that actively works alongside them?

Grounded in a direct architecture read of the current codebase (`src/modules/`, `supabase/migrations/`), not assumption — every claim below traces to a specific file or table. NOVA PIP v1 is treated as a foundation, not something to rebuild.

---

## Phase 1 — Current Capability Assessment

### What NOVA already knows how to do

- Ingest and structure content — documents, notes, images, spreadsheets — through a real processing/chunking/embedding pipeline (`src/modules/processing/`).
- Answer questions grounded in that content via RAG chat (`src/modules/ai/`, `src/modules/search/`).
- Extract structured concepts and entities, detect relationships between them, and score confidence (`src/modules/knowledge-intelligence/`) — extraction, canonicalization, evidence-linking, confidence, and relationship detection are all real and production-deployed.
- Remember explicit facts and detected preferences, gated by manual user approval (`src/modules/ai/memory/`).
- Take a small number of explicit, single-step actions on command — a ~32-entry command palette (`src/modules/commands/`) plus a 2-action natural-language router (`src/modules/workspace-actions/`: save-to-notes, generate-briefing).
- Describe a workspace's state after the fact — maturity, timeline, health, knowledge gaps (`src/modules/hub/`, `src/modules/evolution/` equivalent) — retrospective and diagnostic, not forward-looking.
- Explain, via a rule-based (non-LLM) trace, what it "reasoned" about a single turn — visible to the user next to the chat reply.

### What workflows are currently manual

- Every capability requires the user to open a specific surface and act first. Nothing in the product currently initiates itself.
- Personalization is manual and thin: the only place a user's goals, working style, or professional context can live today is a fixed set of memory "chip" fields in Settings (`src/modules/ai/memory/profileFields.ts`) — there is no ongoing adaptation, only additive memory rows a user or a detection heuristic proposes and the user approves.
- Cross-session continuity is manual: nothing resurfaces a stale note, an unfinished objective, or a concept that hasn't been revisited unless the user happens to open the Hub page themselves.

### Where users still need to ask NOVA for help

Everywhere. Every interaction in the product today starts with a user-initiated event — a typed message, a command palette invocation, a button click. There is no NOVA-initiated moment anywhere in the current product.

### Where intelligence is passive instead of proactive

Three findings matter more than the rest, because each is an *unfinished* piece of existing architecture rather than a gap that needs new architecture from zero:

1. **The reasoning/planning layer already exists and is already wired into chat — but only as a display, not a decision.** `src/modules/intelligence/{intent,planner,decision,strategy,learning,orchestrator}` is real, non-trivial code, invoked from `ChatPage.tsx` on every turn. But `planner.ts` states directly in its own comments that it "performs no AI work" — it's a deterministic rule table. Its output populates a reasoning-trace panel shown to the user; the actual prompt sent to the model is built separately in `AIService.ts`/`buildNovaContextPrompt.ts` and never reads from the planner's conclusions. **The scaffolding for planning intelligence already exists; it's pointed at the wrong output.**
2. **The proactive-suggestion affordance exists in the UI shell and is disabled.** The notification bell in the top bar (`TopBar.tsx`) is literally `disabled`, with the placeholder title "No notifications yet." This is a pre-built, empty vessel for exactly what a Proactive Intelligence phase would need.
3. **A recommendation engine already exists, but only fires synchronously when a page is opened.** `dashboardRecommendations.ts` (Hub) generates threshold-based suggestions wrapping existing commands (e.g. "Continue reading," "Review memory suggestions"). It's the one piece of the app that's already shaped like proactive intelligence — it just isn't persisted, isn't delivered anywhere but the Hub page, and has no memory of having been shown or dismissed.

A fourth finding bounds the scope of anything ambitious: **there is no background/scheduled execution anywhere in this system.** No `pg_cron`, no scheduled edge functions — `supabase/functions/` contains exactly two request/response functions (`ai-chat`, `provider-availability`). Every AI capability is a single request in, single completion out; the closest thing to "multi-step" is a fixed, hard-coded pipeline (executive briefing: search → evidence → generate → save), not a loop that observes a result and decides what to do next. This is confirmed explicitly in the codebase's own comments (`src/modules/intelligence/signals/types.ts`): signals are "informational only... no notifications, no background jobs, no auto-created notes/memories" — a previously deliberate scope boundary, not an oversight.

---

## Phase 2 — UX-14 Opportunity Areas

Each area below is graded against what's real today, not aspirational.

### 1. Personal Intelligence Layer
**Current state:** `profiles` (the actual database row) holds almost nothing — `id, email, display_name, default_chat_provider_id`. Everything resembling personalization today is really a typed memory row with a fixed chip vocabulary. There is no first-class model of goals, working style, or professional context distinct from "a fact NOVA happens to remember."
**Opportunity:** promote personalization from a memory subtype to a structured, first-class profile NOVA actively reasons from.

### 2. Proactive Intelligence
**Current state:** zero live proactive behavior; the delivery surface (notification bell) and the suggestion logic (`dashboardRecommendations.ts`) both already exist in unfinished form.
**Opportunity:** the highest-leverage area relative to the guiding question, and — importantly — has a genuinely low-risk first increment: persist and surface what the Hub already computes, through the affordance that's already built, with zero new background execution. A second, larger increment (true background-computed intelligence) requires infrastructure this project does not currently have.

### 3. Intelligence Memory Evolution
**Current state:** a confidence *scorer* already exists (`scoreMemoryConfidence.ts`) but its output is discarded after gating the one-time approval decision — no confidence value is ever persisted on the memory row. Lifecycle is a single manual `is_active` boolean; there's no expiry or reinforcement model.
**Opportunity:** small, contained, and — like Proactive Intelligence — a completion of something already half-built rather than something new.

### 4. Workspace Intelligence
**Current state:** `workspace_objectives` are explicitly documented in their own migration comment as "a simple user-authored checklist... not AI-generated." Evolution/Hub reporting is retrospective.
**Opportunity:** connect the already-built knowledge graph and evolution data to objective-tracking — but this is more valuable *after* NOVA has a real model of the user's goals (area 1), not before.

### 5. Agent Capabilities
**Current state:** none. Every AI capability is single request/response; there is no observe-then-decide execution loop, no tool-calling, anywhere in the runtime.
**Opportunity:** real, but by far the largest architectural lift of the seven areas — and the one with the least existing scaffolding to build on. Should not be a UX-14 launch item; see Phase 3/4.

### 6. Knowledge Intelligence Expansion
**Current state:** extraction, confidence, evidence-linking, and relationship detection are already built and live.
**Opportunity:** the most incremental of the seven — extends something real (pattern/trend detection over the existing graph) rather than building something new. Needs a tight scope statement to avoid becoming open-ended "find insights," a failure mode this project has already had to correct for once (see the Reliability & Truth Audit's duplication findings).

### 7. User Experience Refinement
**Current state:** the command registry and the workspace-action NL router both already exist as reusable substrate; most current friction is "the user must know which surface to visit," not "the AI's answer is wrong."
**Opportunity:** lowest architectural risk of all seven areas — works entirely with what already exists. Best treated as a parallel track running alongside the other phases, not a discrete gated phase.

---

## Phase 3 — Architecture Impact Review

| Area | Existing support | Schema changes | New domain/module | AI runtime impact | Permissions/privacy impact | UX-14 or later |
|---|---|---|---|---|---|---|
| 1. Personal Intelligence Layer | Partial — memory system + chip-field pattern already exist | Yes — a structured shape distinct from `ai_memory.content`'s freeform text | No — extends `settings`/`ai/memory` | Yes — `buildNovaContextPrompt.ts` needs to read the new structured source | Low — same single-owner RLS pattern used everywhere already | UX-14, early |
| 2. Proactive Intelligence (low-risk: persist + surface existing Hub recommendations) | Partial — UI vessel and suggestion logic both exist, just not connected | Yes, small — a table for suggestion/notification state (read/dismissed) | Likely yes — a `notifications` or `proactive-intelligence` module | None required for this increment | New — first area where "what can NOVA surface without an in-flight request" needs an explicit answer, even at this small scale | UX-14, early |
| 2b. Proactive Intelligence (true background computation) | Minimal — no scheduled execution exists anywhere in this project today | Yes | Yes | Yes — new infra, not just new app code | Same as above, larger scale | Future exploration — needs an infra spike first |
| 3. Intelligence Memory Evolution | Strong — scorer, type enum, toggle, edit UI all exist | Yes, small — persist `confidence` (and maybe `last_reinforced_at`) on `ai_memory` | No — extends `ai/memory` | Minor | None | UX-14, early |
| 4. Workspace Intelligence | Partial — objectives and evolution reporting both exist, don't talk to each other | Minor, possibly none | No — extends `workspace-*`/`hub` | Moderate — NOVA-assisted objective generation is new prompting logic | None beyond existing workspace scoping | UX-14, sequenced after areas 1–3 |
| 5. Agent Capabilities | Weak — Workspace Action Router is a reasonable execution substrate, but nothing decides a sequence or observes results | Possibly — depends on whether multi-step state needs to persist across turns | Yes, substantial — a new execution-loop capability | Major — the only area that changes what `AIService` fundamentally does | Significant — the first area where NOVA would act with less direct per-action confirmation than today's model; needs an explicit permission design before any code | UX-14's outer boundary at most; likely deferred to a later cycle |
| 6. Knowledge Intelligence Expansion | Strong — nodes/edges/confidence/evidence/relationship detection all live | Likely none, or a new edge/link type | No — extends `knowledge-intelligence` | Moderate — same shape as existing relationship detection | None new | UX-14, tightly scoped |
| 7. User Experience Refinement | Strong — command registry and action router already exist | None | No | Minor | None | UX-14, parallel track throughout |

---

## Phase 4 — UX-14 Roadmap Proposal

### 1. Vision statement

UX-14 moves NOVA from a system users must operate to a system that maintains an active, structured understanding of who the user is and what they're working toward — and uses that understanding to surface what matters, without waiting to be asked. It does this by first completing three things that already exist in unfinished form (a memory system without persisted confidence, a reasoning layer that doesn't affect behavior, a notification affordance that's disabled) before building anything genuinely new — and it explicitly defers full autonomous execution until NOVA has something worth acting on, rather than building an execution loop first and giving it nothing to reason from.

### 2. Proposed phases

- **UX-14.1 — Personal Intelligence Layer.** Structured personalization (goals, working style, professional context) as a first-class model, not a memory subtype.
- **UX-14.2 — Intelligence Memory Evolution.** Persist confidence on memory rows; complete the scorer that already exists but is currently discarded after use.
- **UX-14.3 — Proactive Intelligence (low-risk increment).** Persist and surface the Hub's existing recommendation logic through the already-built, currently-disabled notification affordance. No new background execution in this phase.
- **UX-14.4 — Workspace Intelligence.** NOVA-assisted objective tracking, sequenced after 14.1 so there's an actual goal model to assist against.
- **UX-14.5 — Knowledge Intelligence Expansion.** Bounded pattern/trend detection over the existing graph — a tightly scoped extension, not an open-ended "find insights" capability.
- **UX-14.6 — User Experience Refinement.** Ongoing, parallel to all of the above — not a discrete gate.
- **Deferred / future exploration:** true background-computed Proactive Intelligence (needs a scheduled-execution infra spike this project hasn't done); Agent Capabilities / autonomous execution (needs an explicit permission and confirmation design first, and is substantially more useful once 14.1–14.4 exist to reason from).

### 3. Priority ranking

- **Must have:** 14.1 Personal Intelligence Layer, 14.2 Memory Evolution, 14.3 Proactive Intelligence (low-risk increment)
- **High value:** 14.4 Workspace Intelligence, 14.5 Knowledge Intelligence Expansion, 14.6 UX Refinement (parallel)
- **Future exploration:** true background-computed Proactive Intelligence, Agent Capabilities

### 4. Dependencies

- 14.3 works without 14.1, but becomes more valuable once 14.1 exists (recommendations can become personalized rather than workspace-generic).
- 14.4 depends on 14.1 — objective assistance needs a real goal model to assist against, or it's just automating a checklist that was already manual for no clear reason.
- Agent Capabilities depends on 14.1 and 14.3 both existing (an agent needs something to reason from and a place to report back through) and on a permission/confirmation model that does not exist in any form today.
- True background Proactive Intelligence depends on a scheduled-execution infrastructure decision that must happen before that work can even be estimated.

### 5. Risks

- **Permission ambiguity.** The current safety property — nothing happens unless the user clicks or types a matched phrase — is implicit, not a designed policy. Proactive Intelligence and especially Agent Capabilities each erode a piece of that property. Each phase that does so should state the erosion as a deliberate decision, not let it fall out of implementation details.
- **Capability sprawl.** "Deeper reasoning over patterns and trends" and "agent capabilities" are both open-ended by nature. Each needs a concrete scope boundary before implementation starts — this project has already had to correct once for duplicated/sprawling logic (the Reliability & Truth Audit), and these two areas are the most likely to repeat that pattern if left loosely scoped.
- **Repurposing vs. duplicating the existing reasoning layer.** The UX-12 intent/planner/decision modules already exist and are wired into chat as a passive trace. Any UX-14 work that wants planning to actually drive behavior must explicitly decide whether it's repurposing that existing module or building new logic beside it — doing both silently would recreate exactly the "two implementations of the same concern" pattern the Reliability & Truth Audit found and fixed this cycle.
- **Missing infrastructure for true proactive intelligence.** No scheduled-execution capability exists in this Supabase project today. Estimating that work requires a spike to confirm what's actually available, not a design document alone.
- **Live production blast radius.** This is the first roadmap phase to begin against a deployed product with real users. Unlike every prior phase, day-one work here has production consequences — which is the direct argument for the low-risk-first sequencing above: complete existing unfinished pieces before adding new execution surfaces.

### 6. Recommended implementation order

14.1 → 14.2 → 14.3 (low-risk) → 14.4 → 14.5 → 14.6 (parallel throughout) → **decision point:** spike proactive-execution infrastructure and design an explicit agent permission/confirmation model → future exploration items (true background Proactive Intelligence, Agent Capabilities)
