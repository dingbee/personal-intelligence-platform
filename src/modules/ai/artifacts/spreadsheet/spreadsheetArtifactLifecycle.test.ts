import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import type { Note } from '@/shared/types/database'
import { detectArtifactKind } from '@/modules/ai/artifacts/detectArtifactKind'
import { buildArtifactGenerationMetadata } from '@/modules/ai/artifacts/buildArtifactGenerationMetadata'
import { getArtifactData, getArtifactKind } from '@/modules/ai/artifacts/artifactMetadata'
import { sheetToGrid } from '@/modules/ai/artifacts/spreadsheet/sheetToGrid'
import { buildSpreadsheetWorkbook } from '@/modules/ai/artifacts/spreadsheet/buildSpreadsheetWorkbook'
import { buildSpreadsheetCsv, spreadsheetExportFilename } from '@/modules/ai/artifacts/spreadsheet/exportSpreadsheetArtifact'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'

/**
 * UX-14.4.5 — Artifact Acceptance Harness. This is a "lightweight but real"
 * acceptance path, not a live-authenticated-browser-against-Supabase
 * harness (that remains the disclosed, un-built gap this codebase's UX-14
 * milestones have flagged since UX-14.2 — see the discovery doc's own
 * Acceptance Harness section). What makes this "real" rather than a set of
 * isolated unit tests: every step below calls the actual production
 * function used in the live save/export path, in the actual order the app
 * calls them, on one shared fixture — the exact chain the milestone's own
 * diagram specifies:
 *
 *   Artifact creation -> Metadata classification -> Artifact data
 *   generation -> Preview rendering -> XLSX export -> Formula preservation
 *   -> Download integrity
 *
 * A realistic AI response — a markdown table with one formula cell, the
 * same shape `SaveConversationDialog`/`saveMessageToNote` see from a real
 * chat message.
 */
const AI_RESPONSE = [
  "Here's your occupancy forecast:",
  '',
  '| Month | Available Rooms | Sold Rooms | Occupancy % |',
  '| --- | --- | --- | --- |',
  '| January | 744 | 520 | =C2/B2 |',
  '| February | 672 | 480 | =C3/B3 |',
].join('\n')

describe('spreadsheet artifact lifecycle', () => {
  it('carries a chat response through classification, persistence, preview, and export without losing the formula', () => {
    // 1. Artifact creation + 2. Metadata classification — the exact call
    // saveMessageToNote/SaveConversationDialog make on a real response.
    const kind = detectArtifactKind(AI_RESPONSE)
    expect(kind).toBe('spreadsheet')

    // 3. Artifact data generation — same helper both note-creation call
    // sites use, with the same kind of provenance fields saveMessageToNote
    // attaches.
    const generationMetadata = buildArtifactGenerationMetadata(AI_RESPONSE, kind, {
      savedFrom: 'chat-message',
      conversationId: 'conv-1',
      messageId: 'message-1',
    })
    expect(generationMetadata.artifactKind).toBe('spreadsheet')
    expect(generationMetadata.artifactData).toBeDefined()

    // Metadata survives the lifecycle: generation_metadata is a Postgres
    // jsonb column, so a JSON.stringify/parse round trip is what actually
    // proves it survives storage, not just reusing the same in-memory
    // object reference.
    const persistedMetadata = JSON.parse(JSON.stringify(generationMetadata)) as Record<string, unknown>
    const note: Pick<Note, 'generation_metadata'> = { generation_metadata: persistedMetadata }

    expect(getArtifactKind(note)).toBe('spreadsheet')
    const artifactData = getArtifactData<SpreadsheetArtifactData>(note)
    expect(artifactData).not.toBeNull()
    expect(artifactData!.sheets).toHaveLength(1)

    const sheet = artifactData!.sheets[0]!
    expect(sheet.columns).toEqual(['Month', 'Available Rooms', 'Sold Rooms', 'Occupancy %'])
    // The formula cell survived classification -> metadata -> the jsonb
    // round trip with its formula intact and unevaluated.
    const occupancyCell = sheet.cells.find((c) => c.cell === 'D2')
    expect(occupancyCell).toEqual({ cell: 'D2', formula: 'C2/B2' })

    // 4. Preview rendering — same function NoteDetailPage's
    // SpreadsheetArtifactPanel calls. The formula cell renders as literal
    // text, never a computed number.
    const grid = sheetToGrid(sheet)
    expect(grid[0]).toEqual(['Month', 'Available Rooms', 'Sold Rooms', 'Occupancy %'])
    expect(grid[1]).toEqual(['January', 744, 520, '=C2/B2'])

    // 5. XLSX export + 6. Formula preservation + 7. Download integrity —
    // the actual bytes a Download click would produce, read back with a
    // real XLSX.read, exactly as SpreadsheetArtifactPanel's XLSX button
    // and exportSpreadsheetArtifact together do end to end.
    const workbook = buildSpreadsheetWorkbook(artifactData!)
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const reopened = XLSX.read(bytes, { type: 'array' })
    const reopenedSheet = reopened.Sheets[workbook.SheetNames[0]!]!

    expect(reopenedSheet['D2']?.f).toBe('C2/B2')
    expect(reopenedSheet['B2']?.v).toBe(744)
    expect(reopenedSheet['A2']?.v).toBe('January')

    // CSV path through the same dispatcher — literal values only, no
    // formula concept in CSV (documented, expected limitation).
    const csv = buildSpreadsheetCsv(artifactData!)
    expect(csv.trim().split('\n')[0]).toBe('Month,Available Rooms,Sold Rooms,Occupancy %')

    // Filenames used by the actual Download button.
    expect(spreadsheetExportFilename('Occupancy Forecast', 'xlsx')).toBe('occupancy-forecast.xlsx')
    expect(spreadsheetExportFilename('Occupancy Forecast', 'csv')).toBe('occupancy-forecast.csv')
  })

  it('never attaches artifactData for a response with no table, and the lifecycle degrades to plain classification', () => {
    const content = 'Sure, happy to help with that.'
    const kind = detectArtifactKind(content)
    expect(kind).toBe('note')

    const metadata = buildArtifactGenerationMetadata(content, kind)
    const note: Pick<Note, 'generation_metadata'> = { generation_metadata: JSON.parse(JSON.stringify(metadata)) }

    expect(getArtifactKind(note)).toBe('note')
    expect(getArtifactData(note)).toBeNull()
  })
})
