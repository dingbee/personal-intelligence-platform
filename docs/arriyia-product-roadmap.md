# ARRIYIA Product Roadmap

Produced by Sprint 9.5/10 as part of the pre-freeze release-scope review. This document captures the post-Personal strategic direction **without implementing any of it** — every item here is a future candidate, not authorized work. See `docs/arriyia-personal-release-backlog.md` for the itemized backlog that assigns individual capabilities to each tier, and `docs/pip-release-scope-v1.md` for what v1 actually is.

```
ARRIYIA Personal
        ↓
ARRIYIA Business
        ↓
ARRIYIA Enterprise
```

## ARRIYIA Personal (this release)

Individual intelligence: one person's knowledge, memory, and reasoning. Validated end-to-end across Sprints 1-9.4 and scoped precisely in `docs/pip-release-scope-v1.md`. Domain: personal knowledge, research, learning, reading, notes, memory, personal context, personal reasoning, intelligent search, knowledge connections.

## ARRIYIA Business (future)

Organizational intelligence: a team or company's knowledge, decisions, and operations. Domain: accounts, finance, marketing, sales, operations, legal, HR, business intelligence, business memory, workflows, decision intelligence.

**What Personal v1 already carries toward this direction, unintentionally or otherwise:**
- Workspace collaboration (member roles, shared notes/assets/knowledge nodes under RLS) is already built and shipped in Personal. This is worth naming honestly: it's organizational-shaped functionality living inside a product whose core proposition is individual. It is **not** being removed — it's tested, it works, and ripping it out would be exactly the kind of scope-destructive move this review is meant to prevent. But Business should be understood as the tier where this capability graduates to first-class status (richer permission models, audit trails, org-wide policy), not as something Personal needs to develop further on its own.
- The reasoning planner's `responseStrategy` classification already exists and is computed on every turn, currently used only for the UI's "Explain My Answer" trace. Decision Intelligence (Business) is the more natural home for actually acting on that classification, since a business workflow more often has a small set of well-defined response strategies (approve/escalate/summarize/route) than a personal Q&A turn does.
- Artifact generation (currently spreadsheets only) and "Improve this artifact" both point toward business reporting/analysis as their strongest use case — a business user generating and iterating on a report is a more natural fit than a personal user doing the same.

### Potential module architecture: domain-vertical vs. horizontal capabilities

Two structurally different ways Business could be built, worth stating explicitly rather than deciding now:

**Option A — Domain-vertical modules**, one per business function:
```
Core Business Intelligence
├── Finance
├── Accounting
├── Marketing
├── Sales
├── Operations
├── HR
├── Legal
├── Customer Intelligence
└── Decision Intelligence
```
Each module would need its own extraction/knowledge-graph vocabulary (a "Finance" concept type differs from a "Legal" one), its own domain-specific artifact templates, and likely its own retrieval tuning. This mirrors how many enterprise SaaS platforms are actually sold (per-department seats/modules) but risks re-fragmenting the single coherent retrieval/knowledge-graph architecture Sprints 1-9 deliberately consolidated — each new vertical is real, ongoing surface area, not just configuration.

**Option B — Horizontal capabilities, domain-agnostic**: keep one retrieval engine, one knowledge graph, one memory system (as Personal already does), and let *content* carry domain meaning rather than the platform. A "Finance" workspace is just a workspace whose documents/notes happen to be financial — the same document/note/spreadsheet/chat/memory/graph primitives Personal already has, applied to business content, plus the organizational layer (permissions, roles, audit) Business genuinely needs on top.

**Recommendation, not a decision**: Option B is more consistent with this codebase's own established discipline — every sprint from 4 through 9 explicitly avoided building "a second X" (a second retrieval engine, a second memory system, a second error taxonomy) in favor of extending the one that exists. A domain-vertical architecture (Option A) would be the first genuine break from that pattern in this project's history, and should only be adopted if a real, evidenced business requirement demonstrates that horizontal primitives + organizational features aren't enough — the same "measure or prove it, don't build for theoretical need" discipline Sprint 9/10 applied to performance work. This is a recommendation for whoever scopes Business, not an architecture decision made here.

## ARRIYIA Enterprise (future)

Institutional intelligence: organizations, governments, or institutions with governance, compliance, and departmental-boundary requirements Business doesn't need. Domain: organizational intelligence, institutional memory, governance, departments, advanced permissions, compliance, enterprise knowledge, agents, government/institutional use cases.

**What points toward this tier:**
- True background/scheduled intelligence ("NOVA noticed something while you were away") — this deployment has exactly two request/response edge functions and no scheduled execution anywhere (confirmed by inspecting `supabase/functions/`). Building this properly (a real job scheduler, not a cron hack) is an infrastructure investment that pays off at institutional scale, where many users' proactive-intelligence computation can share the same scheduled infrastructure — building it for one Personal user at a time doesn't justify the investment.
- Agent Capabilities (multi-step autonomous action-taking) explicitly require a permission/confirmation model that doesn't exist anywhere in this codebase yet. Enterprise governance needs (audit trails, approval chains, role-scoped action limits) are the natural forcing function that would make building this model rigorous rather than ad hoc — building a lightweight version for Personal first would likely need rebuilding once real governance requirements arrive.
- Compliance/governance tooling and departmental knowledge boundaries have no Personal or Business analog — they only make sense once "the organization" itself has internal sub-boundaries to enforce.

## What this roadmap deliberately does not do

It does not commit to Option A or B for Business's module architecture. It does not schedule Business or Enterprise work. It does not imply Personal v1 is incomplete for lacking any of this — per `docs/pip-release-scope-v1.md`, Personal's proposition is coherent and complete on its own terms. This document exists so that when Business or Enterprise work is eventually authorized, it starts from an explicit strategic model instead of organically accumulating scope the way "wrong-tier" features (like collaboration living inside Personal) can happen without one.
