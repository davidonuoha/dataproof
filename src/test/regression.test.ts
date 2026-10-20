/**
 * Regression tests.
 *
 * Each case below corresponds to a defect that was found while building
 * DataProof. They are kept so the same mistake cannot return unnoticed.
 */
import { describe, expect, it } from 'vitest'
import { compareDatasets } from '../lib/compare'
import { inferColumnType, looksLikeHeader, parseCsvText } from '../lib/csv'
import { buildColumnProfiles } from '../lib/profile'
import { runAnalysis } from '../lib/analyze'
import { checkDates } from '../lib/checks/dates'
import { defaultSettings } from '../lib/types'

const parse = (csv: string) => parseCsvText(csv, 'regression.csv', csv.length, {})

describe('regression: type inference must not hide unreadable values', () => {
  it('still treats a mostly-numeric column as numeric', () => {
    // Bug: inference required *every* value to parse as a number, so a single
    // "n/a" turned the whole column into text and the invalid values were never
    // reported at all.
    expect(inferColumnType(['1', '2', '3', '4', 'n/a'])).toBe('number')
  })

  it('reports the unreadable values once the column is numeric', () => {
    const table = parse('amount\n1\n2\n3\n4\nn/a\n')
    const profiles = buildColumnProfiles(table)
    expect(profiles[0].type).toBe('number')
    const result = runAnalysis({ table, profiles, settings: defaultSettings() })
    const invalid = result.findings.find((f) => f.id === 'numeric-invalid-amount')
    expect(invalid?.rows).toEqual([5])
  })

  it('still treats a genuinely textual column as text', () => {
    expect(inferColumnType(['Lagos', 'Kano', 'Abuja'])).toBe('text')
    expect(inferColumnType(['AN-001', 'AN-002'])).toBe('text')
  })

  it('does not mistake identifiers with leading zeros for numbers', () => {
    expect(inferColumnType(['007', '012', '021'])).toBe('text')
  })
})

describe('regression: a mostly-date column is still a date column', () => {
  it('detects the column type so the one bad value can be reported', () => {
    // Bug: the same all-or-nothing rule meant a single malformed date made the
    // column "text" and date validation was silently skipped.
    expect(inferColumnType(['2023-01-01', '2023-04-01', '2023-07-01', 'unknown'])).toBe('date')
  })

  it('reports the value that fails the format', () => {
    const table = parse('period\n2023-01-01\n2023-04-01\n2023-07-01\nunknown\n')
    const profiles = buildColumnProfiles(table)
    const settings = { ...defaultSettings(), dateFormats: { period: 'YYYY-MM-DD' as const } }
    const findings = checkDates(table, profiles, settings)
    expect(findings.find((f) => f.id === 'dates-invalid-period')?.rows).toEqual([4])
  })

  it('does not call a plain text column a date column', () => {
    expect(inferColumnType(['Lagos', 'Kano', 'Abuja', 'Enugu'])).toBe('text')
  })
})

describe('regression: duplicate column names must not break header detection', () => {
  it('still treats a row with a repeated heading as a header', () => {
    // Bug: the header heuristic rejected any first row with duplicate values,
    // so a file with a repeated heading was read as headerless data and the
    // duplication was never reported.
    expect(looksLikeHeader(['amount', 'amount'])).toBe(true)
  })

  it('reports the duplicate heading', () => {
    const table = parse('amount,amount\n1,2\n')
    expect(table.hasHeader).toBe(true)
    expect(table.parseIssues.some((i) => i.code === 'DuplicateHeader')).toBe(true)
  })

  it('still refuses to treat a row of numbers as a header', () => {
    expect(looksLikeHeader(['1', '2'])).toBe(false)
  })
})

describe('regression: repeated identifiers must not silently drop rows', () => {
  it('reports the surplus row instead of discarding it', () => {
    // Bug: when a key matched several rows on one side, only the first pair was
    // compared and every other row vanished from the result, so a record could
    // be removed between versions without the comparison noticing.
    const older = parse('id,v\n1,a\n1,b\n')
    const newer = parse('id,v\n1,a\n')
    const result = compareDatasets(older, newer, ['id'])
    expect(result.counts.removed).toBe(1)
    expect(result.records.some((r) => r.kind === 'removed' && r.oldRow === 2)).toBe(true)
  })

  it('reports surplus rows on the newer side as added', () => {
    const older = parse('id,v\n1,a\n')
    const newer = parse('id,v\n1,a\n1,b\n1,c\n')
    const result = compareDatasets(older, newer, ['id'])
    expect(result.counts.added).toBe(2)
  })

  it('still warns that a repeated identifier makes the pairing unreliable', () => {
    const older = parse('id,v\n1,a\n1,b\n')
    const newer = parse('id,v\n1,a\n')
    const result = compareDatasets(older, newer, ['id'])
    expect(result.findings.some((f) => f.id === 'comparison-duplicate-key')).toBe(true)
    expect(result.limitations.join(' ')).toMatch(/not unique/i)
  })
})

describe('regression: a renamed column is never matched automatically', () => {
  it('does not compare values across a rename, and says so', () => {
    // Deliberate behaviour, locked in by a test: guessing that two differently
    // named columns are "the same" would invent comparisons the user never
    // asked for. The rename is reported as an added and a removed column.
    const older = parse('id,total\n1,100\n')
    const newer = parse('id,amount\n1,100\n')
    const result = compareDatasets(older, newer, ['id'])
    expect(result.columnChanges).toContainEqual({ name: 'amount', change: 'added' })
    expect(result.columnChanges).toContainEqual({ name: 'total', change: 'removed' })
    expect(result.records.flatMap((r) => r.changes)).toHaveLength(0)
  })
})

describe('regression: malformed rows must not shift the table', () => {
  it('pads a short row and reports it', () => {
    const table = parse('a,b,c\n1,2,3\n4,5\n6,7,8\n')
    expect(table.rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', ''],
      ['6', '7', '8'],
    ])
    expect(table.parseIssues.filter((i) => i.code === 'TooFewFields')).toHaveLength(1)
  })

  it('truncates a long row for display and reports it', () => {
    const table = parse('a,b\n1,2\n3,4,5,6\n')
    expect(table.rows[1]).toEqual(['3', '4'])
    expect(table.parseIssues.filter((i) => i.code === 'TooManyFields')).toHaveLength(1)
  })
})

describe('regression: legitimate zero values', () => {
  it('keeps zero out of the missing-value findings', () => {
    // A completely blank line is not a data row, so the empty cell is expressed
    // inside a real record with a second column present.
    const table = parse('amount,note\n0,a\n0.00,b\n,c\n')
    const profiles = buildColumnProfiles(table)
    expect(profiles[0].emptyCount).toBe(1)
    expect(profiles[0].nonEmptyCount).toBe(2)
    const result = runAnalysis({ table, profiles, settings: defaultSettings() })
    const missing = result.findings.find((f) => f.id === 'missing-amount')
    expect(missing?.rows).toEqual([3])
  })
})
