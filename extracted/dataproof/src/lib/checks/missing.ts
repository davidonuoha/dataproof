import { isBlank } from '../csv'
import type { ColumnProfile, Finding, ParsedTable } from '../types'
import { capRows } from './helpers'

/**
 * Missing-value detection.
 *
 * A cell counts as missing only when it is empty or whitespace. `0`, `false`,
 * `0.00` and any text are present values — conflating them with missing data is
 * one of the most common and most damaging data-quality mistakes.
 */
export function checkMissingValues(table: ParsedTable, profiles: ColumnProfile[]): Finding[] {
  const findings: Finding[] = []
  const totalCells = table.rows.length * table.headers.length
  let totalMissing = 0
  const rowsWithMissing = new Set<number>()

  for (const profile of profiles) {
    const affected: number[] = []
    table.rows.forEach((row, index) => {
      if (isBlank(row[profile.index])) {
        affected.push(index + 1)
        rowsWithMissing.add(index + 1)
      }
    })
    if (affected.length === 0) continue

    totalMissing += affected.length
    const percent = table.rows.length > 0 ? (affected.length / table.rows.length) * 100 : 0
    const { rows, truncated, total } = capRows(affected)

    findings.push({
      id: `missing-${profile.name}`,
      category: 'missing',
      severity: 'warning',
      title: `Column "${profile.name}" has ${affected.length} empty cell${affected.length === 1 ? '' : 's'}`,
      explanation:
        `Empty cells were found in "${profile.name}" on ${affected.length} of ${table.rows.length} rows ` +
        `(${percent.toFixed(1)}%). Empty cells are not the same as zero: a zero is a recorded value, ` +
        `whereas an empty cell means nothing was recorded. Calculations over this column will treat these rows ` +
        `as having no value, which can change totals, averages and chart scales.`,
      columns: [profile.name],
      rows,
      method: 'A cell is counted as missing when, after trimming whitespace, it contains no characters.',
      nextStep:
        'Open the affected records and decide whether the emptiness is meaningful (for example "not applicable") ' +
        'or whether the value is genuinely absent from the source. If the column must always be populated, add a ' +
        '"must not be empty" validation rule.',
      uncertainty:
        'An empty cell is a fact about the file. Whether it is a problem depends on what the column is supposed to ' +
        'contain, which DataProof cannot know.',
      evidence: {
        column: profile.name,
        missingCount: affected.length,
        missingPercent: Number(percent.toFixed(2)),
        rowCount: table.rows.length,
        rowsTruncated: truncated,
        affectedRowTotal: total,
      },
    })
  }

  if (totalMissing > 0) {
    const percent = totalCells > 0 ? (totalMissing / totalCells) * 100 : 0
    findings.push({
      id: 'missing-summary',
      category: 'missing',
      severity: 'warning',
      title: `${totalMissing} empty cell${totalMissing === 1 ? '' : 's'} across ${rowsWithMissing.size} row${rowsWithMissing.size === 1 ? '' : 's'}`,
      explanation:
        `In total, ${totalMissing} of ${totalCells} cells (${percent.toFixed(2)}%) are empty. ` +
        `${rowsWithMissing.size} row${rowsWithMissing.size === 1 ? '' : 's'} contain at least one empty cell.`,
      columns: profiles.filter((p) => p.emptyCount > 0).map((p) => p.name),
      rows: capRows([...rowsWithMissing].sort((a, b) => a - b)).rows,
      method: 'Count of cells that contain no characters after trimming whitespace.',
      nextStep: 'Review the per-column findings to see which fields are affected and how often.',
      uncertainty: 'Zero values, false and any text are counted as present data, not as missing.',
      evidence: {
        totalMissing,
        totalCells,
        missingPercent: Number(percent.toFixed(2)),
        rowsWithMissing: rowsWithMissing.size,
      },
    })
  }

  return findings
}
