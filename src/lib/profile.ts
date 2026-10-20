import { inferColumnType, isBlank, detectDateFormat } from './csv'
import type { ColumnProfile, ColumnType, ParsedTable } from './types'

/**
 * Build a profile for every column: detected type, emptiness, distinct values
 * and a few examples the journalist can inspect.
 */
export function buildColumnProfiles(table: ParsedTable, overrides: Record<string, ColumnType> = {}): ColumnProfile[] {
  return table.headers.map((name, index) => {
    const values = table.rows.map((row) => row[index] ?? '')
    const nonEmpty = values.filter((v) => !isBlank(v))
    const detectedType = inferColumnType(values)
    const override = overrides[name]
    const distinct = new Set(nonEmpty.map((v) => v.trim()))
    const examples: string[] = []
    for (const value of nonEmpty) {
      const trimmed = value.trim()
      if (!examples.includes(trimmed)) examples.push(trimmed)
      if (examples.length >= 5) break
    }
    return {
      name,
      index,
      detectedType,
      type: override ?? detectedType,
      userOverride: override !== undefined,
      nonEmptyCount: nonEmpty.length,
      emptyCount: values.length - nonEmpty.length,
      distinctCount: distinct.size,
      examples,
    }
  })
}

/**
 * Suggest a date format per column and report which columns look like dates.
 * Used to pre-fill the analysis settings with something defensible.
 */
export function suggestDateFormats(table: ParsedTable, profiles: ColumnProfile[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const profile of profiles) {
    if (profile.type !== 'date') continue
    const values = table.rows.map((row) => row[profile.index] ?? '')
    const { bestFormat, matched } = detectDateFormat(values)
    const nonEmpty = values.filter((v) => !isBlank(v)).length
    if (bestFormat && matched >= Math.max(1, Math.ceil(nonEmpty * 0.5))) {
      result[profile.name] = bestFormat
    }
  }
  return result
}
