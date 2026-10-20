import { checkCategoryConsistency } from './checks/categories'
import { checkCrossField } from './checks/crossfield'
import { checkDates } from './checks/dates'
import { checkExactDuplicates, checkKeyDuplicates } from './checks/duplicates'
import { checkMissingValues } from './checks/missing'
import { checkNumeric, computeNumericStats } from './checks/numeric'
import { checkRules } from './checks/rules'
import { checkStructure } from './checks/structure'
import { SEVERITY_ORDER } from './types'
import type {
  AnalysisResult,
  AnalysisSettings,
  AnalysisSummary,
  ColumnProfile,
  Finding,
  ParsedTable,
  Severity,
} from './types'

export const CHECK_NAMES = [
  'Structural checks (malformed rows, empty columns, header assumption)',
  'Missing-value detection',
  'Exact duplicate detection',
  'Key-based duplicate detection',
  'Category consistency (case and whitespace variants)',
  'Date validation against a selected format',
  'Numerical validation, descriptive statistics and outlier detection',
  'User-defined validation rules',
  'User-defined cross-field comparisons',
] as const

export const ANALYSIS_LIMITATIONS = [
  'DataProof checks whether a dataset is internally consistent. It cannot confirm that any figure matches the real world; that requires the original source document.',
  'An outlier is a value that is far from the rest of the distribution. It is reported for investigation and is never treated as an error.',
  'Missing values are only detected as empty cells. A placeholder such as "N/A", "unknown" or "-99" is present data and will not be reported as missing.',
  'Category inconsistencies are based on letter case and whitespace only. Semantically different labels for the same thing are not detected.',
  'A date value that fails the selected format may be valid under a different convention; DataProof does not change dates.',
  'Statistics describe the values that parsed successfully. Rows excluded by invalid values are not represented in them.',
]

export interface RunAnalysisInput {
  table: ParsedTable
  profiles: ColumnProfile[]
  settings: AnalysisSettings
}

/**
 * Run every check and assemble a single result object.
 *
 * Findings are sorted by severity (errors first) and then by category, so the
 * most consequential issues are at the top of the dashboard and the report.
 */
export function runAnalysis({ table, profiles, settings }: RunAnalysisInput): AnalysisResult {
  const numericStats = computeNumericStats(table, profiles, settings)

  const findings: Finding[] = [
    ...checkStructure(table, profiles),
    ...checkMissingValues(table, profiles),
    ...checkExactDuplicates(table),
    ...checkKeyDuplicates(table, settings.duplicateKeyColumns),
    ...checkCategoryConsistency(table, profiles),
    ...checkDates(table, profiles, settings),
    ...checkNumeric(table, profiles, numericStats, settings),
    ...checkRules(table, settings.rules),
    ...checkCrossField(table, settings.crossFieldRules),
  ]

  findings.sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (severity !== 0) return severity
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.title.localeCompare(b.title)
  })

  const affectedRows = new Set<number>()
  for (const finding of findings) {
    for (const row of finding.rows) affectedRows.add(row)
  }

  const bySeverity: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
  const byCategory: AnalysisSummary['byCategory'] = {}
  for (const finding of findings) {
    bySeverity[finding.severity] += 1
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1
  }

  return {
    datasetName: table.fileName,
    generatedAt: new Date().toISOString(),
    settings,
    findings,
    numericStats,
    summary: {
      recordCount: table.rows.length,
      columnCount: table.headers.length,
      findingCount: findings.length,
      bySeverity,
      byCategory,
      affectedRowCount: affectedRows.size,
    },
    checksPerformed: [...CHECK_NAMES],
    limitations: [...ANALYSIS_LIMITATIONS],
  }
}
