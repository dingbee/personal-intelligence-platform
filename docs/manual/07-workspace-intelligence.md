# Chapter 7: Workspace Intelligence

## Purpose

A workspace is a bounded slice of your knowledge — a project, a business, an area of your life. Workspace Intelligence is the executive-level view of one: what's in it, what's changed recently, and where the gaps are, without you having to assemble that picture yourself.

## Feature Overview

- **Workspace Intelligence Hub** — the homepage for a workspace: recent notes, active conversations, and a summary of what's happening in it
- **Executive Dashboard** — a higher-level rollup of workspace activity and knowledge state
- **Workspace Evolution / timeline** — how a workspace's knowledge has grown and changed over time
- **Workspace objectives + knowledge gap detection** — declare what a workspace is meant to accomplish, and NOVA surfaces where the existing knowledge doesn't yet support that objective
- **Workspace management** — create, switch between, and archive workspaces; a global "All workspaces" view exists alongside individual ones

## Navigation

- **Hub** (sidebar) — the workspace homepage; this is also the default landing page when a workspace is selected
- **Dashboard** and **Evolution** (sidebar) — the Executive Dashboard and the timeline view
- The workspace switcher (top of the sidebar) — create, switch, or manage workspaces

## Real-World Examples

- Switch into your "Mtoni Expansion" workspace, and the Hub immediately shows recent notes and active conversations scoped to just that project, not your entire account.
- Set an objective like "understand Q4 supplier costs," and Workspace Intelligence flags that you have supplier meeting notes but no actual invoices uploaded yet — a concrete gap, not a vague reminder.
- Check Workspace Evolution after a few weeks of work to see the shape of what's accumulated, rather than trying to remember it.

## Typical Workflows

1. **Start a project as a workspace**: create a workspace, set an objective, and let the Hub become that project's home base as you add documents, notes, and conversations to it.
2. **Periodic gap check**: revisit a workspace's objectives occasionally and let knowledge gap detection tell you what's still missing before you assume you're done.
3. **Executive skim**: use the Dashboard when you want the rollup, not the detail — it's built for a quick "where do things stand" check.

## Best Practices

- Give a workspace a real objective, not just a name — gap detection needs something concrete to measure against.
- Use "All workspaces" sparingly and deliberately — most day-to-day work benefits from being scoped to one workspace, both for your own focus and for the intelligence surfaces that reason about workspace-scoped content.
- Revisit the Evolution timeline before a review or handoff — it's a faster way to reconstruct "what happened here" than reading back through every note.

## Common Mistakes

- Treating workspaces as folders rather than as objective-bearing project spaces — the gap detection and executive summary features only add value once an objective exists.
- Forgetting that Knowledge Graph nodes are shared across all your workspaces (Chapter 4) — a workspace's dashboard reflects activity scoped to it, but the underlying concepts a workspace surfaces may have evidence from other workspaces too.

## Related Features

- **Chat & AI** (Chapter 3) — active conversations surface on the Hub
- **Notes** (Chapter 2) — recent notes surface on the Hub
- **Knowledge Graph** (Chapter 4) — workspace intelligence draws on graph state to help identify gaps

## AI Capabilities

- Executive summaries are LLM-composed from workspace activity, not templated text
- Knowledge gap detection is a mix of deterministic checks (what categories of content exist vs. what an objective implies should exist) composed with LLM judgment for the less structured parts

## Limitations

- Objectives are currently free-text with deterministic-plus-LLM gap analysis, not a structured goal-tracking system
- No cross-workspace comparison view yet (e.g., comparing two workspaces' knowledge density side by side)

## Future Roadmap

- Workspace Intelligence refinements and Personal Dashboard refinements are both named as remaining UX-13 items — expect the executive summary and gap detection to get sharper as Knowledge Confidence scoring (Chapter 4) becomes available to draw on
