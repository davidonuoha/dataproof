import type { AnalysisResult, ColumnProfile, ComparisonResult, Finding, ParsedTable } from '../types'
import { CATEGORY_LABELS, SEVERITY_LABELS } from '../types'

export interface ExportOptions {
  /** Include the values of affected records. Off by default for privacy. */
  includeValues: boolean
  /** Maximum affected records included per finding when values are included. */
  maxRecordsPerFinding: number
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeValues: false,
  maxRecordsPerFinding: 100,
}

export const TOOL_INFO = {
  name: 'DataProof',
  version: '0.1.0',
  description: 'An open-source data quality tool for journalists.',
  processing: 'All processing happens in the browser. No dataset is uploaded to a server.',
}

interface AffectedRecord {
  row: number
  values?: Record<string, string>
}

function affectedRecords(
  finding: Finding,
  table: ParsedTable | null,
  options: ExportOptions,
): AffectedRecord[] | undefined {
  if (!options.includeValues || !table || finding.rows.length === 0) return undefined
  return finding.rows.slice(0, options.maxRecordsPerFinding).map((row) => {
    const cells = table.rows[row - 1]
    const values: Record<string, string> = {}
    if (cells) {
      table.headers.forEach((header, index) => {
        values[header] = cells[index] ?? ''
      })
    }
    return { row, values }
  })
}

export interface JsonReport {
  tool: typeof TOOL_INFO
  reportType: 'dataset-analysis'
  generatedAt: string
  privacy: {
    includedRecordValues: boolean
    note: string
  }
  dataset: {
    fileName: string
    fileSizeBytes: number
    delimiter: string
    hasHeader: boolean
    recordCount: number
    columnCount: number
    columns: Array<{
      name: string
      type: string
      detectedType: string
      userOverride: boolean
      nonEmptyCount: number
      emptyCount: number
      distinctCount: number
    }>
    parseIssues: ParsedTable['parseIssues']
  }
  settings: AnalysisResult['settings']
  checksPerformed: string[]
  summary: AnalysisResult['summary']
  findings: Array<Omit<Finding, 'rows'> & { affectedRowCount: number; affectedRecords?: AffectedRecord[] }>
  numericStatistics: AnalysisResult['numericStats']
  limitations: string[]
}

/**
 * Build the machine-readable report. The row list is always included as
 * numbers; values are only included when the user has explicitly opted in.
 */
export function buildJsonReport(
  analysis: AnalysisResult,
  table: ParsedTable | null,
  profiles: ColumnProfile[],
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): JsonReport {
  return {
    tool: TOOL_INFO,
    reportType: 'dataset-analysis',
    generatedAt: analysis.generatedAt,
    privacy: {
      includedRecordValues: options.includeValues,
      note: options.includeValues
        ? 'This report includes values from the analysed dataset because the option to include record values was enabled. Handle the file accordingly.'
        : 'This report reproduces no records from the analysed dataset. Individual findings quote a small number of example values (up to 20) to explain what was detected, but the values of affected records are not reproduced.',
    },
    dataset: {
      fileName: analysis.datasetName,
      fileSizeBytes: table?.fileSizeBytes ?? 0,
      delimiter: table?.delimiter ?? '',
      hasHeader: table?.hasHeader ?? true,
      recordCount: analysis.summary.recordCount,
      columnCount: analysis.summary.columnCount,
      columns: profiles.map((p) => ({
        name: p.name,
        type: p.type,
        detectedType: p.detectedType,
        userOverride: p.userOverride,
        nonEmptyCount: p.nonEmptyCount,
        emptyCount: p.emptyCount,
        distinctCount: p.distinctCount,
      })),
      parseIssues: table?.parseIssues ?? [],
    },
    settings: analysis.settings,
    checksPerformed: analysis.checksPerformed,
    summary: analysis.summary,
    findings: analysis.findings.map((finding) => {
      const { rows, ...rest } = finding
      const records = affectedRecords(finding, table, options)
      return {
        ...rest,
        affectedRowCount: rows.length,
        ...(records ? { affectedRecords: records } : {}),
      }
    }),
    numericStatistics: analysis.numericStats,
    limitations: analysis.limitations,
  }
}

export function serializeJsonReport(report: unknown): string {
  return JSON.stringify(report, null, 2)
}

/* ------------------------------------------------------------------------- */
/* Comparison report                                                          */
/* ------------------------------------------------------------------------- */

export interface JsonComparisonReport {
  tool: typeof TOOL_INFO
  reportType: 'dataset-comparison'
  generatedAt: string
  privacy: { includedRecordValues: boolean; note: string }
  olderDataset: { fileName: string; recordCount: number; columnCount: number }
  newerDataset: { fileName: string; recordCount: number; columnCount: number }
  alignment: string
  keyColumns: string[]
  columnChanges: ComparisonResult['columnChanges']
  counts: ComparisonResult['counts']
  findings: ComparisonResult['findings']
  limitations: string[]
  recordsIncluded: number
  records: ComparisonResult['records']
}

export function buildJsonComparisonReport(
  comparison: ComparisonResult,
  oldTable: ParsedTable,
  newTable: ParsedTable,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): JsonComparisonReport {
  return {
    tool: TOOL_INFO,
    reportType: 'dataset-comparison',
    generatedAt: comparison.generatedAt,
    privacy: {
      includedRecordValues: options.includeValues,
      note: options.includeValues
        ? 'This report includes values from both datasets because the option to include record values was enabled.'
        : 'This report lists record identifiers and changed values only; unchanged values are not included.',
    },
    olderDataset: {
      fileName: oldTable.fileName,
      recordCount: oldTable.rows.length,
      columnCount: oldTable.headers.length,
    },
    newerDataset: {
      fileName: newTable.fileName,
      recordCount: newTable.rows.length,
      columnCount: newTable.headers.length,
    },
    alignment: comparison.alignment,
    keyColumns: comparison.keyColumns,
    columnChanges: comparison.columnChanges,
    counts: comparison.counts,
    findings: comparison.findings,
    limitations: comparison.limitations,
    recordsIncluded: comparison.records.length,
    records: comparison.records,
  }
}

export function categoryLabel(finding: Finding): string {
  return CATEGORY_LABELS[finding.category] ?? finding.category
}

export function severityLabel(finding: Finding): string {
  return SEVERITY_LABELS[finding.severity] ?? finding.severity
}
