import { isAmbiguousDate, isBlank, parseDateWithFormat } from '../csv'
import type { AnalysisSettings, ColumnProfile, Finding, ParsedTable } from '../types'
import { capRows } from './helpers'

/**
 * Date validation.
 *
 * Every value in a date column is interpreted using one explicit format chosen
 * by the user (or detected from the data). Values that the format cannot
 * interpret are reported verbatim. Ambiguous values such as 03/04/2024 are
 * reported as ambiguous rather than silently resolved.
 */
export function checkDates(table: ParsedTable, profiles: ColumnProfile[], settings: AnalysisSettings): Finding[] {
  const findings: Finding[] = []

  for (const profile of profiles) {
    if (profile.type !== 'date') continue
    const format = settings.dateFormats[profile.name]
    if (!format) {
      findings.push({
        id: `dates-noformat-${profile.name}`,
        category: 'dates',
        severity: 'warning',
        title: `No date format selected for "${profile.name}"`,
        explanation:
          `The values in "${profile.name}" look like dates, but no date format has been chosen, so they cannot be validated. ` +
          `Until a format is chosen DataProof will not guess: guessing is how 03/04/2024 silently becomes either 3 April or 4 March.`,
        columns: [profile.name],
        rows: [],
        method: 'A column is only validated against a date when one explicit format has been selected for it.',
        nextStep: 'Choose the date format used by the source data on the Analyze screen, then run the checks again.',
        uncertainty: 'DataProof cannot determine which date convention the source used.',
        evidence: { column: profile.name, format: null },
      })
      continue
    }

    const failures: number[] = []
    const failureExamples: string[] = []
    const ambiguous: number[] = []
    let parsedCount = 0

    table.rows.forEach((row, index) => {
      const raw = (row[profile.index] ?? '').trim()
      if (isBlank(raw)) return
      if (parseDateWithFormat(raw, format)) {
        parsedCount += 1
        if (isAmbiguousDate(raw)) ambiguous.push(index + 1)
      } else {
        failures.push(index + 1)
        if (failureExamples.length < 20 && !failureExamples.includes(raw)) failureExamples.push(raw)
      }
    })

    const userChosen = settings.dateFormatSource[profile.name] === 'user'

    if (failures.length > 0) {
      const { rows, truncated, total } = capRows(failures)
      findings.push({
        id: `dates-invalid-${profile.name}`,
        category: 'dates',
        severity: userChosen ? 'error' : 'warning',
        title: `${failures.length} value${failures.length === 1 ? '' : 's'} in "${profile.name}" do not match the format ${format}`,
        explanation:
          `The column "${profile.name}" is being read as a date using the format ${format}. ` +
          `${failures.length} non-empty value${failures.length === 1 ? '' : 's'} cannot be interpreted with that format. ` +
          `Examples: ${failureExamples.map((v) => `"${v}"`).join(', ')}. ` +
          `These values will be missing from any date-based sort, filter or timeline built on this column.`,
        columns: [profile.name],
        rows,
        method: `Each non-empty value is parsed strictly against the pattern ${format}; a value that does not match, or that represents an impossible date such as 31 February, is reported.`,
        nextStep:
          'Compare the listed values with the source file. They may be a different date convention, a typo, a placeholder ' +
          'such as "N/A", or a value that has been shifted into the wrong column.',
        uncertainty:
          'A value that fails one format may be perfectly valid under another. Change the selected format if the source ' +
          'data uses a different convention.',
        evidence: {
          column: profile.name,
          format,
          formatSource: settings.dateFormatSource[profile.name] ?? 'auto',
          failureCount: failures.length,
          parsedCount,
          examples: failureExamples,
          rowsTruncated: truncated,
          affectedRowTotal: total,
        },
      })
    }

    if (ambiguous.length > 0 && (format === 'DD/MM/YYYY' || format === 'MM/DD/YYYY' || format === 'DD-MM-YYYY' || format === 'MM-DD-YYYY')) {
      const { rows } = capRows(ambiguous)
      findings.push({
        id: `dates-ambiguous-${profile.name}`,
        category: 'dates',
        severity: 'info',
        title: `${ambiguous.length} value${ambiguous.length === 1 ? '' : 's'} in "${profile.name}" are ambiguous`,
        explanation:
          `${ambiguous.length} value${ambiguous.length === 1 ? '' : 's'} in "${profile.name}" would be a valid date under both ` +
          `day-first and month-first conventions (for example 03/04/2024). DataProof read them as ${format}, as instructed, ` +
          `and has not changed them. If the source uses the other convention, these dates are wrong by months.`,
        columns: [profile.name],
        rows,
        method: 'A value is ambiguous when it parses successfully under both a day-first and a month-first pattern.',
        nextStep:
          'Confirm the convention in the source documentation or with the data provider, then set the correct format. ' +
          'Prefer ISO 8601 (YYYY-MM-DD) in published datasets to remove the ambiguity entirely.',
        uncertainty:
          'DataProof cannot tell which convention is intended; the selected format is applied as given.',
        evidence: { column: profile.name, format, ambiguousCount: ambiguous.length },
      })
    }
  }

  return findings
}
