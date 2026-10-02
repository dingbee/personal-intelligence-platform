# ARRIYIA V2 Existing-Code Inventory

## Application
- React 19 / Vite / TypeScript
- React Router
- TanStack Query
- Supabase client
- shared error, theme, layout and UI systems

## Core platform
- `src/modules/core` — registry/capability/module architecture
- `src/modules/workspaces` — workspace management and membership
- `src/modules/admin` — administrative controls
- `src/modules/plans` / `billing` — commercial controls

## Intelligence foundation
- `src/modules/ai/orchestration` — AI service and context/reasoning orchestration
- `src/modules/ai/memory` — memory detection, ranking, confidence and retrieval
- `src/modules/ai/retrieval` — vector retrieval
- `src/modules/knowledge-intelligence` — knowledge exploration and intelligence
- `src/modules/analysis-intelligence`
- `src/modules/research-intelligence`
- `src/modules/planning-intelligence`
- `src/modules/decision-intelligence`
- `src/modules/action-intelligence`
- `src/modules/data-intelligence`
- `src/modules/workspace-intelligence`
- `src/modules/learning-intelligence`

## Execution/provenance
- `src/modules/execution-foundation`
- `src/modules/intelligence-ledger`
- `src/shared/provenance`
- `src/modules/workspace-actions`

## Knowledge and content
- library
- notes
- processing/document intelligence
- assets
- reader
- search
- knowledge graph
- AI artifacts

## V2 implication
A substantial portion of the intended V2 substrate already exists. The immediate engineering problem is architectural consolidation, contracts, governance and runtime separation—not feature accumulation.
