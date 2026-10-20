import { isBlank, parseNumber } from '../csv'
import type { Finding, ParsedTable, ValidationRule } from '../types'
import { capRows } from './helpers'

export function describeRule(rule: ValidationRule): string {
  const column = `"${rule.column}"`
  switch (rule.kind) {
    case 'required':
      return `${column} must not be empty`
    case 'range': {
      const min = rule.min === undefined || Number.isNaN(rule.min) ? null : rule.min
      const max = rule.max === undefined || Number.isNaN(rule.max) ? null : rule.max
      if (min !== null && max !== null) return `${column} must be between ${min} and ${max}`
      if (min !== null) return `${column} must be at least ${min}`
      if (max !== null) return `${column} must be at most ${max}`
      return `${column} must be within a range (no bounds set)`
    }
    case 'unique':
      return `${column} must contain unique values`
    case 'allowed':
      return `${column} must be one of: ${(rule.allowed ?? []).join(', ') || '(no permitted values set)'}`
    case 'nonnegative':
      return `${column} must be greater than or equal to zero`
    default:
      return `${column} must satisfy a rule`
  }
}

/**
 * Evaluate the user-defined validation rules.
 *
 * These are the only findings that can carry the `error` severity without
 * further interpretation, because the rule was stated explicitly by the user.
 */
export function checkRules(table: ParsedTable, rules: ValidationRule[]): Finding[] {
  const findings: Finding[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const index = table.headers.indexOf(rule.column)
    if (index < 0) continue

    const label = rule.label?.trim() || describeRule(rule)
    const violations: number[] = []
    const examples: { row: number; value: string; reason: string }[] = []

    const add = (rowNumber: number, value: string, reason: string) => {
      violations.push(rowNumber)
      if (examples.length < 20) examples.push({ row: rowNumber, value, reason })
    }

    switch (rule.kind) {
      case 'required': {
        table.rows.forEach((row, i) => {
          const raw = row[index] ?? ''
          if (isBlank(raw)) add(i + 1, '', 'empty')
        })
        break
      }
      case 'range': {
        table.rows.forEach((row, i) => {
          const raw = (row[index] ?? '').trim()
          if (isBlank(raw)) {
            if (!rule.ignoreEmpty) add(i + 1, '', 'empty')
            return
          }
          const n = parseNumber(raw)
          if (n === null) {
            add(i + 1, raw, 'not a number')
            return
          }
          if (rule.min !== undefined && !Number.isNaN(rule.min) && n < rule.min) add(i + 1, raw, `below ${rule.min}`)
          else if (rule.max !== undefined && !Number.isNaN(rule.max) && n > rule.max) add(i + 1, raw, `above ${rule.max}`)
        })
        break
      }
      case 'nonnegative': {
        table.rows.forEach((row, i) => {
          const raw = (row[index] ?? '').trim()
          if (isBlank(raw)) {
            if (!rule.ignoreEmpty) add(i + 1, '', 'empty')
            return
          }
          const n = parseNumber(raw)
          if (n === null) add(i + 1, raw, 'not a number')
          else if (n < 0) add(i + 1, raw, 'negative')
        })
        break
      }
      case 'unique': {
        const seen = new Map<string, number[]>()
        table.rows.forEach((row, i) => {
          const raw = (row[index] ?? '').trim()
          if (isBlank(raw)) return
          const key = raw
          const list = seen.get(key)
          if (list) list.push(i + 1)
          else seen.set(key, [i + 1])
        })
        for (const [value, rows] of seen) {
          if (rows.length > 1) {
            for (const rowNumber of rows) add(rowNumber, value, `value repeated on ${rows.length} rows`)
          }
        }
        break
      }
      case 'allowed': {
        const allowed = (rule.allowed ?? []).map((v) => v.trim()).filter((v) => v !== '')
        const allowedSet = new Set(allowed.map((v) => v.toLowerCase()))
        table.rows.forEach((row, i) => {
          const raw = (row[index] ?? '').trim()
          if (isBlank(raw)) return
          if (!allowedSet.has(raw.toLowerCase())) add(i + 1, raw, 'not in the permitted list')
        })
        break
      }
      default:
        break
    }

    if (violations.length === 0) continue
    const { rows, truncated, total } = capRows(violations)

    findings.push({
      id: `rule-${rule.id}`,
      category: 'rules',
      severity: 'error',
      title: `${violations.length} violation${violations.length === 1 ? '' : 's'} of the rule "${label}"`,
      explanation:
        `The rule you defined — ${label} — is violated by ${violations.length} row${violations.length === 1 ? '' : 's'}. ` +
        (examples.length > 0
          ? `Examples: ${examples
              .slice(0, 5)
              .map((e) => `row ${e.row} (${e.reason}${e.value ? `: "${e.value}"` : ''})`)
              .join('; ')}.`
          : ''),
      columns: [rule.column],
      rows,
      method: `User-defined rule: ${label}.${rule.kind === 'allowed' ? ' Matching is case-insensitive and ignores surrounding whitespace.' : ''}`,
      nextStep:
        'Inspect the affected rows and correct them at source, or confirm that the rule needs adjusting. ' +
        'Rules are stored with the analysis so the same check can be re-run on the next version of the dataset.',
      uncertainty:
        'This is an error only in the sense that the data contradicts a rule you set. If the rule does not describe the ' +
        'real world for this dataset, the finding is a false positive and the rule should be changed.',
      evidence: {
        rule: { ...rule, label },
        violationCount: violations.length,
        examples,
        rowsTruncated: truncated,
        affectedRowTotal: total,
      },
    })
  }

  return findings
}
