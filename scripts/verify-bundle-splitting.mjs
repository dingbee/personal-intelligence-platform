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
// Two assertions:
//   1. `xlsx` is still split into its own chunk (not inlined into main).
//   2. The main entry chunk stays under a ceiling comfortably below what
//      it grew to when the regression happened (~1.40 MB at the time),
//      so a reintroduced eager import fails this check loudly.

import { readdirSync, statSync } from 'node:fs'
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

if (failed) process.exit(1)
