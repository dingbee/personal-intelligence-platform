# Chapter 1: Library & Reading

## Purpose

The Library is where everything you own lives before NOVA does anything intelligent with it — every document, book, spreadsheet, and image you've uploaded. Reading is where you actually consume that material, with NOVA available alongside it rather than as a separate destination you have to leave to.

## Feature Overview

- **Document upload** — PDF, EPUB, DOCX, TXT, and Markdown files, dropped or browsed in from the Library page
- **Collections and tags** — organize documents into folders (collections) and cross-cutting labels (tags), independent of each other
- **Document Detail page** — a single document's full picture: metadata, processing status, tags, collection, chunk count, and (for spreadsheets) the Spreadsheet Summary Card
- **Readers**, one per content type, all reachable from the same "Read" entry point on a document card:
  - **PDF Reader** — renders actual PDF pages with a text layer, page navigation, and zoom
  - **EPUB Reader** — chapter-based reading with a chapter list
  - **Spreadsheet Reader** — xlsx/csv/ods files rendered as a real grid, sheet by sheet
  - **Image Reader** — a dedicated reading view for images, distinct from the quick-preview Lightbox
- **Spreadsheet Intelligence** — column type detection, financial-pattern recognition, and an Analyst Layer that grounds both the Summary Card and in-Reader chat in the sheet's actual computed figures, not a guess at raw cell text
- **Image handling** — upload with automatic derivative generation (an optimized version and a thumbnail, alongside the original), and a Lightbox for quick preview without leaving the grid

## Navigation

- **Library** (sidebar) — the default landing point for documents; a tab switcher at the top toggles between **Documents** and **Images**
- Click any document card to open its **Document Detail** page, or use the card's menu for direct **Read** / **Chat** shortcuts
- Reading a document opens the appropriate Reader automatically based on its file type — you don't choose a reader, NOVA resolves it

## Real-World Examples

- Upload a PDF of a quarterly report, and NOVA's PDF Reader shows you the actual pages with selectable text, while the in-Reader Chat panel (Chapter 3) can already answer questions about it once processing finishes.
- Upload an `.xlsx` export of your bookings data. NOVA doesn't just render a grid — Spreadsheet Intelligence detects which columns are dates, which are currency, computes aggregates, and the Summary Card on the Document Detail page shows you the headline numbers before you've opened the sheet at all.
- Drop a folder of property photos into the Images tab. Each gets a thumbnail generated client-side, and you can flip through them in the Lightbox without waiting for a full page load per image.

## Typical Workflows

1. **Upload → organize → read**: drop a file on the Library page, assign it to a collection and a couple of tags, then click Read when you're ready to go through it.
2. **Upload → let Spreadsheet Intelligence work → check the Summary Card**: for financial or tabular data, upload it and check the Document Detail page's Summary Card before opening the full Reader — it's often enough on its own.
3. **Read → Chat alongside**: open a document in its Reader, and use the Chat panel docked in the same view to ask questions without switching pages.

## Best Practices

- Tag documents by topic, not by file type — the file type is already visible from the icon and reader; tags are more useful as a second, orthogonal axis (e.g., "Q3", "Marketing", "Draft").
- For spreadsheets, upload the actual source file (xlsx/csv/ods) rather than a PDF export of it — Spreadsheet Intelligence needs real cell data, not rendered text, to detect columns and compute aggregates.
- Let a document finish processing before relying on Chat or Search results from it — the Document Detail page's processing status badge tells you when it's ready.

## Common Mistakes

- Assuming a PDF's Chat grounding is available immediately on upload — processing (chunking, embedding) happens asynchronously and needs to complete first.
- Uploading scanned/image-only PDFs and expecting full-text search or chat grounding to work as well as it does for text-based PDFs — OCR is not yet part of the pipeline (see Limitations).
- Treating Collections and Tags as redundant — Collections are single-parent (a document lives in one), Tags are many-to-many (a document can have several). Use Collections for structure, Tags for cross-cutting labels.

## Related Features

- **Chat & AI** (Chapter 3) — every readable document is chat-grounded once processed
- **Knowledge Graph** (Chapter 4) — running "Analyze Document" on a Document Detail page extracts concepts/entities that feed the graph
- **Universal Search** (Chapter 5) — document content is searchable once embedded
- **Knowledge Capture** (Chapter 6) — Quick Capture is a faster on-ramp into the Library for a single file

## AI Capabilities

- Spreadsheet Intelligence's column/type/pattern detection is deterministic (no LLM call) — fast and consistent, not a model guess
- Chapter/sheet summaries surfaced in the Reader are LLM-generated and grounded in the document's own chunks, not general knowledge
- Knowledge extraction (concepts/entities) from a document is a separate, manually-triggered step from the Document Detail page, covered in Chapter 4

## Limitations

- No OCR/vision pipeline yet — scanned documents and image content aren't text-extracted or chat-grounded (planned, backlog)
- No spreadsheet formula engine — Spreadsheet Intelligence reads computed values, not live formulas (planned, backlog)
- The Library's document list is not virtualized — very large libraries may feel slower to filter/scroll (tracked alongside the Knowledge Explorer's own pagination gap)

## Future Roadmap

- Image OCR & Vision — extracting text and understanding visual content from images and scanned pages
- Spreadsheet Formula Engine and a dedicated Spreadsheet Analyst Agent — deeper, more autonomous financial analysis
