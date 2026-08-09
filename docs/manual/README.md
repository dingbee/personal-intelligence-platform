# The ARRIYIA Manual

ARRIYIA is your Personal Intelligence Platform — a system that captures what you read, write, and discuss, and turns it into something that can answer questions on your behalf, not just store files for later. This manual documents the platform as it exists today, verified working in the deployed application as of the Stabilization & Acceptance Sprint.

## How this manual is organized

Each chapter covers one functional area of the platform, structured the same way throughout:

- **Purpose** — what problem this area solves and why it exists
- **Feature Overview** — what's actually in it
- **Navigation** — where to find it
- **Real-World Examples** — concrete scenarios, not abstractions
- **Typical Workflows** — the sequences of actions that get real work done
- **Best Practices** — how to get the most out of it
- **Common Mistakes** — what trips people up
- **Related Features** — where this connects to the rest of the platform
- **AI Capabilities** — what's AI-driven here, and what isn't
- **Limitations** — what this deliberately doesn't do yet
- **Future Roadmap** — where this is headed, where applicable

Screenshots are marked as pending throughout — this manual documents behavior first; visual capture is a follow-up pass once the chapters themselves are stable.

## Chapters

1. [Library & Reading](./01-library-and-reading.md) — documents, books, spreadsheets, images: uploading, organizing, and reading them
2. [Notes](./02-notes.md) — your own writing, and writing ARRIYIA helps you capture from everything else
3. [Chat & AI](./03-chat-and-ai.md) — talking to ARRIYIA, grounded in your own knowledge
4. [AI Knowledge Graph & Intelligence](./04-knowledge-graph.md) — the concepts and entities ARRIYIA extracts, how they connect, and the separate Content Connections graph (documents/notes/highlights/tags)
5. [Universal Search](./05-universal-search.md) — finding files, and increasingly, finding knowledge
6. [Knowledge Capture](./06-knowledge-capture.md) — getting anything into ARRIYIA in one motion
7. [Workspace Intelligence](./07-workspace-intelligence.md) — the executive view of what a workspace knows
8. [Settings & Platform](./08-settings-and-platform.md) — providers, workspaces, and the platform's operating controls

## The four-layer architecture

ARRIYIA is organized around four interacting layers, and every chapter in this manual sits inside one of them:

- **Knowledge Layer** — documents, notes, images, spreadsheets, conversations (Chapters 1, 2, 6)
- **Intelligence Layer** — search, graph, summaries, analysis, reasoning (Chapters 3, 4, 5)
- **Memory Layer** — personalization, preferences, long-term context (part of Chapter 3, Settings)
- **Execution Layer** — commands, automations, and future agents (Chapter 6, and where UX-14+ will land)

This is a deliberate architectural principle, not incidental structure: every new capability is expected to plug into one of these four layers by reusing an existing pipeline, rather than becoming an isolated subsystem. That's why, for example, Notes and Conversations both feed the same AI Knowledge Graph that Documents do (Chapter 4), and why Universal Search spans all three Knowledge Layer sources plus the AI Knowledge Graph itself (Chapter 5) rather than being document-only.

## What "accepted" means in this manual

Every feature documented here has been verified working in the deployed application, not just implemented in code. See `docs/feature-matrix.md` for the engineering-level status of every feature, including what's still in progress or backlog.
