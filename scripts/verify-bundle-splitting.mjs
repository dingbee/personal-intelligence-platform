#!/usr/bin/env node
// UX-14.4.5 — Artifact Acceptance Harness. Run after `npm run build`.
//
// Ground-truth regression check for the eager-xlsx-import bug found and
// fixed in UX-14.4 Phase 2 (Path A): inspects the actual `dist/assets`
// output rather than source text, since that's the only thing that
// proves what a user's browser would actually download. Not part of
// `npm test` — it depends on a completed `vite build`, so it's a
// separate, explicit verification step, same tier as `npm run build`
// and `npm run lint` already are in this project's manual checklist.
//
// Assertions:
//   1. `xlsx` is still split into its own chunk (not inlined into main).
//   2. The main entry chunk stays under a ceiling comfortably below what
//      it grew to when the regression happened (~1.40 MB at the time),
//      so a reintroduced eager import fails this check loudly.
//   3. PDF processing/reader ("Failed to fetch dynamically imported
//      module" production incident) — the pdf extractor and PDF reader
//      chunks are still split out (lazy-loading preserved), and every
//      static import inside every emitted chunk resolves to a real file
//      in this same dist/assets directory. That last check is a genuine
//      build-internal-consistency proof (Rollup would never emit an
//      unresolvable reference within one build) — it can't catch the
//      actual cross-*deployment* mismatch that caused the incident (an
//      old deployment's hashed chunk no longer existing once a new one
//      is promoted; that's a runtime concern, covered instead by
//      resilientDynamicImport.ts and its own unit tests), but it does
//      catch a genuinely broken build before it ever ships.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ASSETS_DIR = join(import.meta.dirname, '..', 'dist', 'assets')
const MAIN_ENTRY_PATTERN = /^index-.*\.js$/
const XLSX_CHUNK_PATTERN = /^xlsx-.*\.js$/
// Baseline at the time this script was written was ~978 KB; the
// regression pushed it to ~1.40 MB. 1.15 MB gives real headroom for
// ordinary growth while still catching a reintroduced eager xlsx pull.
const MAIN_ENTRY_MAX_BYTES = 1_150_000

let files
try {
  files = readdirSync(ASSETS_DIR)
} catch {
  console.error(`Could not read ${ASSETS_DIR} — run "npm run build" first.`)
  process.exit(1)
}

const mainEntry = files.find((f) => MAIN_ENTRY_PATTERN.test(f))
const xlsxChunk = files.find((f) => XLSX_CHUNK_PATTERN.test(f))

let failed = false

if (!mainEntry) {
  console.error('Could not find a main entry chunk (index-*.js) in dist/assets.')
  failed = true
} else {
  const size = statSync(join(ASSETS_DIR, mainEntry)).size
  if (size > MAIN_ENTRY_MAX_BYTES) {
    console.error(
      `Main entry chunk (${mainEntry}) is ${(size / 1024).toFixed(0)} KB, over the ${(MAIN_ENTRY_MAX_BYTES / 1024).toFixed(0)} KB ceiling. ` +
        'This is the exact symptom of xlsx (or another large dependency) being statically imported into an eagerly-loaded page instead of behind a React.lazy() boundary — see NoteDetailPage.tsx / ReaderPage.tsx for the established pattern.',
    )
    failed = true
  } else {
    console.log(`Main entry chunk OK: ${mainEntry} (${(size / 1024).toFixed(0)} KB, under ${(MAIN_ENTRY_MAX_BYTES / 1024).toFixed(0)} KB ceiling).`)
  }
}

if (!xlsxChunk) {
  console.error('Could not find a separate xlsx-*.js chunk in dist/assets — xlsx may have been inlined into an eager bundle.')
  failed = true
} else {
  console.log(`xlsx chunk OK: split into its own file (${xlsxChunk}).`)
}

// PDF processing/reader chunk presence — both dynamic-import paths named
// in the "Failed to fetch dynamically imported module" incident.
const PDF_EXTRACTOR_CHUNK_PATTERN = /^pdf-.*\.js$/
const PDF_READER_CHUNK_PATTERN = /^PdfReaderView-.*\.js$/

const pdfExtractorChunk = files.find((f) => PDF_EXTRACTOR_CHUNK_PATTERN.test(f))
const pdfReaderChunk = files.find((f) => PDF_READER_CHUNK_PATTERN.test(f))

if (!pdfExtractorChunk) {
  console.error('Could not find a separate pdf-*.js chunk in dist/assets — the PDF processing extractor may have been inlined or its dynamic import broken.')
  failed = true
} else {
  console.log(`PDF processing chunk OK: split into its own file (${pdfExtractorChunk}).`)
}

if (!pdfReaderChunk) {
  console.error('Could not find a separate PdfReaderView-*.js chunk in dist/assets — the PDF reader may have been inlined or its dynamic import broken.')
  failed = true
} else {
  console.log(`PDF reader chunk OK: split into its own file (${pdfReaderChunk}).`)
}

// Build-internal-consistency check — every relative static import inside
// every emitted .js chunk must resolve to a real file in this same
// directory. A single build is always internally consistent by
// construction (this can't catch the actual cross-deployment mismatch —
// see the header comment), but it does prove Rollup didn't emit a
// reference to a chunk it forgot to also emit.
const RELATIVE_IMPORT_PATTERN = /from\s*["'](\.\/[^"']+\.m?js)["']/g
const jsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))
let danglingImports = 0

for (const file of jsFiles) {
  let source
  try {
    source = readFileSync(join(ASSETS_DIR, file), 'utf8')
  } catch {
    continue
  }
  for (const match of source.matchAll(RELATIVE_IMPORT_PATTERN)) {
    const referenced = match[1].replace(/^\.\//, '')
    if (!files.includes(referenced)) {
      console.error(`Dangling import: ${file} references "${referenced}", which does not exist in dist/assets.`)
      danglingImports += 1
      failed = true
    }
  }
}

if (danglingImports === 0) {
  console.log(`Import graph OK: every relative static import across ${jsFiles.length} emitted chunk(s) resolves to a real file in dist/assets.`)
}

if (failed) process.exit(1)
