# Chapter 2: Notes

## Purpose

Notes are where your own thinking lives — separate from documents you've uploaded and conversations you've had with NOVA, but connected to both. A note can stand alone, or it can carry provenance back to the highlight, conversation, or document it came from.

## Feature Overview

- **Notes CRUD** — create, edit, and delete notes from a dedicated Notes list and detail page
- **Note tags** — the same cross-cutting tagging model documents use, applied to notes
- **Save conversation → Note** — turn an entire Chat conversation into a note in one action, from either the main Chat page or the in-Reader Chat panel
- **Save a single message → Note** (AI Workspace Actions v1) — save just one message from a conversation, either your own question or NOVA's reply, via a **Save to Notes** button under that specific message; the note keeps a provenance link to both the conversation and that exact message
- **Save by typing it** (AI Workspace Actions v1) — say "Save this," "Remember this," "Capture this," or "Add this to my notes" in Chat, and NOVA saves its own most recent reply as a note the same way the per-message button does, no menu required
- **Create note from highlight** — while reading, select text and save it as a note directly, carrying a link back to the source document
- **Note ↔ Asset linking** — notes created from an image (via the Image Reader's "Save to Notes") carry a link back to that image
- **Summarize** — an AI action available on a note that replaces its content with a condensed version, grounded in the note's own existing text
- **Merge Notes** — a Knowledge Actions v1 capability: select two or more notes from the Notes list and combine them into one, with their content joined under headings and their tags unioned; the originals are deleted

## Navigation

- **Notes** (sidebar) — the full list of your notes, most recently updated first
- Click a note to open its detail page, where you edit title and content directly and see any linked source
- From a document Reader or the Chat page, look for **Save to Notes** to create a note without visiting the Notes page first
- Under any individual Chat message, click the small **Save to Notes** link to save just that message — or type "Save this" / "Remember this" / "Capture this" / "Add this to my notes" to save NOVA's last reply without touching the mouse
- On the Notes list, click **Merge notes** to enter selection mode, check two or more notes, then click **Merge**

## Real-World Examples

- While reading a PDF report, you highlight a key sentence and save it as a note — the note keeps a reference back to exactly where it came from in the document.
- After a long Chat conversation about marketing strategy, you click Save to Notes once, rather than manually copying the exchange — the whole conversation becomes a note you can tag and revisit.
- NOVA gives you a single useful answer buried in an otherwise ordinary conversation — instead of saving the whole thing, you click Save to Notes under just that reply, or simply type "Remember this."
- You jot a quick standalone thought directly in Notes — no document or conversation behind it, just your own writing.
- You have three separate notes from different days about the same trip planning conversation — you select all three and merge them into one consolidated note instead of manually copying content between them.

## Typical Workflows

1. **Capture while reading**: highlight → Save as Note → tag it → move on, without breaking your reading flow.
2. **Capture after a conversation**: finish a useful Chat exchange → Save to Notes → the note is now independently searchable and taggable.
3. **Write, then let NOVA condense**: write a longer note freeform, then use Summarize when you want the condensed version instead of the draft.
4. **Consolidate scattered notes**: once several notes on the same topic pile up, select them in the Notes list and merge — one note to maintain going forward instead of several fragments.

## Best Practices

- Give notes real titles rather than leaving them "Untitled note" — titles are what you scan in the Notes list and what Universal Search surfaces first.
- Use Save to Notes liberally on conversations you'd want to find again later — a conversation buried in Chat history is much harder to rediscover than a tagged, titled note.
- Tag notes the same way you tag documents, so a single tag surfaces everything relevant regardless of which type of object it started as.

## Common Mistakes

- Treating Notes as a dumping ground with no titles or tags, then being unable to find anything later — Notes only pays off as a system if it's organized at roughly the same discipline as the Library.
- Forgetting that Summarize replaces the note's content, not appends to it — save first if you want to keep the original alongside the summary.
- Not realizing a note created from a highlight or conversation still carries provenance — that link is what makes the note more than just a copy-paste; use it to jump back to the source.
- Merging notes expecting the originals to survive — merge is destructive by design (the merged note is the new source of truth), so review the confirmation dialog before confirming.

## Related Features

- **Library & Reading** (Chapter 1) — highlights become notes directly from the Reader
- **Chat & AI** (Chapter 3) — conversations become notes; Chat also grounds answers using knowledge extracted alongside notes
- **Knowledge Graph** (Chapter 4) — as of Phase 2B, saving a note automatically links it as evidence for any already-known concept it mentions, deterministically, with no AI call
- **Universal Search** (Chapter 5) — notes are a first-class, independently searchable source

## AI Capabilities

- Summarize is LLM-based, grounded only in the note's own current content — it doesn't pull in outside context
- Concept-linking (a note becoming evidence for a Knowledge Graph concept) is deliberately **not** AI-based — it's a deterministic text match against concepts already discovered elsewhere, so it's instant and has no hallucination risk (see Chapter 4)

## Limitations

- No note-to-note linking beyond what Universal Search's Knowledge Graph branch surfaces via shared concepts — you can't manually link two notes together yet
- No note versioning — Summarize's content replacement is not undoable from within the note itself

## Future Roadmap

- Convert note → task, once a Task entity exists elsewhere in the platform to convert into
- Natural language commands like "collect everything related to hospitality" spanning notes alongside every other source
