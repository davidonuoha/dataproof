import type { Finding, ParsedTable } from '../types'
import { capRows, MAX_ROWS_PER_FINDING } from './helpers'

function rowSignature(row: string[], indices: number[]): string {
  return indices.map((i) => (row[i] ?? '').trim()).join('\u0000')
}

interface DuplicateGroup {
  rows: number[]
  values: string[]
}

function groupRows(table: ParsedTable, indices: number[]): Map<string, DuplicateGroup> {
  const groups = new Map<string, DuplicateGroup>()
  table.rows.forEach((row, index) => {
    const signature = rowSignature(row, indices)
    const existing = groups.get(signature)
    if (existing) {
      existing.rows.push(index + 1)
    } else {
      groups.set(signature, {
        rows: [index + 1],
        values: indices.map((i) => (row[i] ?? '').trim()),
      })
    }
  })
  return groups
}

/**
 * Exact duplicate rows — every column identical.
 *
 * These are *potential* duplicates. Two genuinely separate transactions can
 * legitimately share every value, so DataProof never removes them and never
 * calls them errors.
 */
export function checkExactDuplicates(table: ParsedTable): Finding[] {
  if (table.rows.length === 0 || table.headers.length === 0) return []
  const indices = table.headers.map((_, i) => i)
  const groups = groupRows(table, indices)
  const duplicates = [...groups.values()].filter((g) => g.rows.length > 1)
  if (duplicates.length === 0) return []

  const affectedRows = duplicates.flatMap((g) => g.rows).sort((a, b) => a - b)
  const extraRows = affectedRows.length - duplicates.length
  const { rows, truncated, total } = capRows(affectedRows)
  const evidenceGroups = duplicates.slice(0, 50).map((g) => ({
    rowNumbers: g.rows,
    values: g.values,
  }))

  return [
    {
      id: 'duplicates-exact',
      category: 'duplicates',
      severity: 'warning',
      title: `${duplicates.length} group${duplicates.length === 1 ? '' : 's'} of identical rows (${extraRows} extra row${extraRows === 1 ? '' : 's'})`,
      explanation:
        `Every column matches within each group, so these rows are indistinguishable in the file. ` +
        `${duplicates.length} group${duplicates.length === 1 ? '' : 's'} repeat, covering ${affectedRows.length} rows in total. ` +
        `A repeated row often means a record was appended twice, but it can also be a genuine coincidence ` +
        `(for example two identical small transactions).`,
      columns: table.headers,
      rows,
      method: 'Rows are grouped by the exact trimmed text of every column. Groups with more than one row are reported.',
      nextStep:
        'Inspect each group. If a record was duplicated, check the original source before removing anything. ' +
        'DataProof does not delete or modify rows.',
      uncertainty:
        'Identical values do not prove that two rows describe the same event. Confirm against the source system.',
      evidence: {
        groupCount: duplicates.length,
        affectedRowCount: affectedRows.length,
        rowsTruncated: truncated,
        affectedRowTotal: total,
        groups: evidenceGroups,
        groupsTruncated: duplicates.length > evidenceGroups.length,
      },
    },
  ]
}

/**
 * Potential duplicates based on user-selected columns.
 *
 * The selected columns define the match. Only rows that agree on all of them
 * are grouped, and the values that caused the match are reported.
 */
export function checkKeyDuplicates(table: ParsedTable, keyColumns: string[]): Finding[] {
  if (keyColumns.length === 0 || table.rows.length === 0) return []
  const indices = keyColumns
    .map((name) => table.headers.indexOf(name))
    .filter((i) => i >= 0)
  if (indices.length === 0) return []

  const groups = groupRows(table, indices)
  const duplicates = [...groups.values()].filter((g) => g.rows.length > 1)
  if (duplicates.length === 0) return []

  const affectedRows = duplicates.flatMap((g) => g.rows).sort((a, b) => a - b)
  const { rows, truncated, total } = capRows(affectedRows)
  const evidenceGroups = duplicates.slice(0, 50).map((g) => ({
    key: g.values,
    rowNumbers: g.rows,
  }))

  return [
    {
      id: 'duplicates-key',
      category: 'duplicates',
      severity: 'warning',
      title: `${duplicates.length} group${duplicates.length === 1 ? '' : 's'} of rows share the same ${keyColumns.map((c) => `"${c}"`).join(', ')}`,
      explanation:
        `Using ${keyColumns.map((c) => `"${c}"`).join(', ')} as the matching key, ${duplicates.length} key value` +
        `${duplicates.length === 1 ? '' : 's'} appear${duplicates.length === 1 ? 's' : ''} more than once, covering ` +
        `${affectedRows.length} rows. The remaining values in those rows may differ, so these are candidates for ` +
        `inspection rather than confirmed duplicates.`,
      columns: keyColumns,
      rows,
      method: `Rows are grouped by the trimmed values of the selected key columns (${keyColumns.join(', ')}). Groups with more than one row are reported.`,
      nextStep:
        'Decide whether the key should be unique. If it should, add a "must contain unique values" rule to this column ' +
        'so future versions of the dataset are checked automatically.',
      uncertainty:
        'A repeated key is only a problem if the key is meant to identify a single record. Some datasets legitimately ' +
        'contain several rows per key (for example one row per payment against one contract).',
      evidence: {
        keyColumns,
        groupCount: duplicates.length,
        affectedRowCount: affectedRows.length,
        rowsTruncated: truncated,
        affectedRowTotal: total,
        groups: evidenceGroups,
        groupsTruncated: duplicates.length > evidenceGroups.length,
        groupLimit: MAX_ROWS_PER_FINDING,
      },
    },
  ]
}
