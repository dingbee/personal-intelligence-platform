import { describe, expect, it } from 'vitest'
import { parseGenerateSpreadsheetCommand } from '@/modules/workspace-actions/actions/generateSpreadsheetCommand'

describe('parseGenerateSpreadsheetCommand', () => {
  it('matches "create a spreadsheet for X"', () => {
    expect(parseGenerateSpreadsheetCommand('create a spreadsheet for a monthly budget')).toEqual({
      request: 'a monthly budget',
    })
  })

  it('matches generate/build/make and model/template/table nouns', () => {
    expect(parseGenerateSpreadsheetCommand('generate a model for quarterly revenue')).toEqual({
      request: 'quarterly revenue',
    })
    expect(parseGenerateSpreadsheetCommand('build a template for a project tracker')).toEqual({
      request: 'a project tracker',
    })
    expect(parseGenerateSpreadsheetCommand('make a table about inventory')).toEqual({ request: 'inventory' })
  })

  it('matches "on"/"of" prepositions', () => {
    expect(parseGenerateSpreadsheetCommand('create a spreadsheet on employee salaries')).toEqual({
      request: 'employee salaries',
    })
    expect(parseGenerateSpreadsheetCommand('create a spreadsheet of expenses')).toEqual({ request: 'expenses' })
  })

  it('is case-insensitive and strips trailing punctuation', () => {
    expect(parseGenerateSpreadsheetCommand('CREATE A SPREADSHEET FOR sales.')).toEqual({ request: 'sales' })
    expect(parseGenerateSpreadsheetCommand('create a spreadsheet for sales!!!')).toEqual({ request: 'sales' })
  })

  it('requires the noun to be spreadsheet/model/template/table', () => {
    expect(parseGenerateSpreadsheetCommand('create a briefing for sales')).toBeNull()
  })

  it('does not match ordinary prose that happens to contain these words', () => {
    expect(parseGenerateSpreadsheetCommand('I created a spreadsheet for my last job, it was great')).toBeNull()
    expect(parseGenerateSpreadsheetCommand('Can you explain what a spreadsheet template is for?')).toBeNull()
  })

  it('returns null for an empty or whitespace-only topic', () => {
    expect(parseGenerateSpreadsheetCommand('create a spreadsheet for ')).toBeNull()
  })
})
