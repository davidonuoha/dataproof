import { isBlank, parseNumber } from '../csv'
import type { CrossFieldRule, Finding, ParsedTable } from '../types'
import { capRows } from './helpers'

/**
 * Make the comparison explicit. The formula is always shown to the user in the
 * same words used in the report, so there is no hidden interpretation.
 */
export function describeCrossFieldRule(rule: CrossFieldRule): string {
  const left = rule.components.map((c) => `"${c}"`).join(' + ') || '(no columns selected)'
  const tolerance =
    rule.toleranceMode === 'percent'
      ? `within ${rule.tolerance}%`
      : `within ${rule.tolerance} absolute units`
  return `${left} should equal "${rule.total}" ${tolerance}`
}

/**
 * Cross-field consistency.
 *
 * DataProof only checks a relationship the user has stated. It never assumes
 * that one column should equal the sum of others, because in real datasets that
 * is often false (different reporting periods, rounding, partial components).
 */
export function checkCrossField(table: ParsedTable, rules: CrossFieldRule[]): Finding[] {
  const findings: Finding[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.components.length === 0 || !rule.total) continue

    const componentIndices = rule.components
      .map((name) => table.headers.indexOf(name))
      .filter((i) => i >= 0)
    const totalIndex = table.headers.indexOf(rule.total)
    if (componentIndices.length === 0 || totalIndex < 0) continue

    const label = rule.label?.trim() || describeCrossFieldRule(rule)
    const mismatches: { row: number; components: number; total: number; difference: number; percent: number }[] = []
    let skipped = 0

    table.rows.forEach((row, i) => {
      const rawComponents = componentIndices.map((ci) => (row[ci] ?? '').trim())
      const rawTotal = (row[totalIndex] ?? '').trim()

      if (rawComponents.some((v) => isBlank(v)) || isBlank(rawTotal)) {
        if (rule.ignoreEmpty) {
          skipped += 1
          return
        }
      }

      const componentValues = rawComponents.map((v) => parseNumber(v))
      const totalValue = parseNumber(rawTotal)
      if (componentValues.some((v) => v === null) || totalValue === null) {
        skipped += 1
        return
      }

      const sum = (componentValues as number[]).reduce((acc, v) => acc + v, 0)
      const difference = totalValue - sum
      const tolerance =
        rule.toleranceMode === 'percent'
          ? Math.abs(sum) * (rule.tolerance / 100)
          : Math.abs(rule.tolerance)

      if (Math.abs(difference) > tolerance) {
        mismatches.push({
          row: i + 1,
          components: sum,
          total: totalValue,
          difference,
          percent: sum !== 0 ? (difference / sum) * 100 : NaN,
        })
      }
    })

    if (mismatches.length === 0) continue

    const { rows, truncated, total } = capRows(mismatches.map((m) => m.row))

    findings.push({
      id: `crossfield-${rule.id}`,
      category: 'crossfield',
      severity: 'error',
      title: `${mismatches.length} row${mismatches.length === 1 ? '' : 's'} where ${label} does not hold`,
      explanation:
        `You asked DataProof to check this relationship: ${label}. ${mismatches.length} row` +
        `${mismatches.length === 1 ? '' : 's'} break it. For example, row ${mismatches[0].row} has components summing to ` +
        `${formatValue(mismatches[0].components)} but a recorded total of ${formatValue(mismatches[0].total)}, a difference of ` +
        `${formatValue(mismatches[0].difference)}. ${skipped > 0 ? `${skipped} row${skipped === 1 ? ' was' : 's were'} skipped because a value was missing or unreadable.` : ''}`,
      columns: [...rule.components, rule.total],
      rows,
      method: `User-defined comparison: ${label}. The formula is evaluated row by row; no other relationship is assumed.`,
      nextStep:
        'Open the affected rows and compare the components with the recorded total. Check for rounding conventions, a ' +
        'component that is out of scope, or a figure entered in the wrong column.',
      uncertainty:
        'A mismatch means the numbers in this file do not add up as you expected. It does not by itself tell you which ' +
        'figure is wrong — the total, a component, or the rule.',
      evidence: {
        rule: { ...rule, label },
        mismatchCount: mismatches.length,
        skippedRows: skipped,
        examples: mismatches.slice(0, 20),
        rowsTruncated: truncated,
        affectedRowTotal: total,
      },
    })
  }

  return findings
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)
}
