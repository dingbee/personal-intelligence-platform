import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSpreadsheetWorkbook } from '@/modules/ai/artifacts/spreadsheet/buildSpreadsheetWorkbook'

/**
 * UX-14.4.5 — Artifact Acceptance Harness. Dedicated regression coverage
 * for the two concrete bugs found and fixed during Phase 2 (Path A), kept
 * separate from the lifecycle/unit tests so a future contributor changing
 * either area sees exactly what broke before and why the fix looks the
 * way it does.
 */
describe('regression: SheetJS drops a formula cell with no cached value', () => {
  it('documents the underlying platform trap directly — a raw {f} cell with no v vanishes on write/read', () => {
    const ws: XLSX.WorkSheet = { A1: { t: 'n', v: 10 }, B1: { t: 'n', f: 'A1*2' }, '!ref': 'A1:B1' }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, ws, 'Sheet1')

    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const reread = XLSX.read(bytes, { type: 'array' })

    // The trap: SheetJS's writer silently omits a formula-only cell.
    expect(reread.Sheets['Sheet1']!['B1']).toBeUndefined()
  })

  it('confirms buildSpreadsheetWorkbook avoids the trap by writing a v:0 placeholder alongside the formula', () => {
    const workbook = buildSpreadsheetWorkbook({
      sheets: [{ name: 'Sheet1', cells: [{ cell: 'A1', value: 10 }, { cell: 'B1', formula: 'A1*2' }] }],
    })

    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const reread = XLSX.read(bytes, { type: 'array' })

    expect(reread.Sheets['Sheet1']!['B1']?.f).toBe('A1*2')
  })
})

describe('regression: NoteDetailPage must not statically import a component that pulls in xlsx', () => {
  // UX-14.4 Phase 2 — the first working version imported
  // SpreadsheetArtifactPanel eagerly, which pulled the ~330KB `xlsx`
  // dependency into the main app bundle for every page load (confirmed
  // via a `vite build` output diff at the time). Source-inspection rather
  // than a full `vite build` here on purpose: this test runs as part of
  // the normal fast `vitest run` loop, not a separate build step, so the
  // regression is caught on every test run, not only when someone
  // remembers to run a build-output check.
  // process.cwd() rather than import.meta.url — vitest's transformed
  // module URLs aren't guaranteed to be real file:// URLs, but this
  // suite (like every other test in the repo) always runs from the
  // project root.
  const source = readFileSync(join(process.cwd(), 'src/modules/notes/pages/NoteDetailPage.tsx'), 'utf-8')

  it('lazy-loads SpreadsheetArtifactPanel instead of importing it statically', () => {
    expect(source).not.toMatch(/^import\s*\{\s*SpreadsheetArtifactPanel\s*\}\s*from/m)
    expect(source).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]@\/modules\/notes\/components\/SpreadsheetArtifactPanel['"]\)/)
  })
})

describe('regression: renderSpreadsheetArtifactMarkdown must not pull xlsx into the eager Workspace Action bundle', () => {
  // UX-14.4.2 — generateSpreadsheetArtifactAction is registered eagerly
  // from App.tsx (Workspace Actions dispatch synchronously from chat —
  // there is no React.lazy() boundary the way a reader page has). The
  // first working version of this milestone reused sheetToGrid.ts for
  // rendering the chat preview, which imports `xlsx` for
  // XLSX.utils.decode_cell — that pulled the ~330KB library into the main
  // bundle (confirmed via a real `vite build`: main entry grew from
  // ~978KB to ~1410KB and the separate xlsx-*.js chunk disappeared, caught
  // by `npm run verify:bundle`). Fixed by `decodeCellAddress`
  // (cellAddressing.ts), a dependency-free inverse of `columnLetter`.
  // Source-inspection here, same reasoning as the check above: this runs
  // on every `vitest run`, not only when someone remembers a full build.
  const source = readFileSync(join(process.cwd(), 'src/modules/ai/artifacts/spreadsheet/renderSpreadsheetArtifactMarkdown.ts'), 'utf-8')

  it('does not import xlsx, directly or via sheetToGrid', () => {
    expect(source).not.toMatch(/from ['"]xlsx['"]/)
    expect(source).not.toMatch(/from ['"].*\/sheetToGrid['"]/)
  })
})
