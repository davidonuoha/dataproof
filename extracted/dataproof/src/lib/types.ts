/**
 * Core domain types for DataProof.
 *
 * A central design decision lives in this file: DataProof separates
 * *structural findings* (a value is missing, a rule was violated) from
 * *statistical observations* (a value is unusually large). Every finding
 * carries the method that produced it, a suggested next step and, where the
 * evidence does not support certainty, an explicit statement of uncertainty.
 */

/** How a column's values were interpreted. Users can override any of these. */
export type ColumnType = 'text' | 'number' | 'date' | 'boolean' | 'unknown'

/** Severity is deliberately narrow, and is defined by what the evidence shows. */
export type Severity = 'error' | 'warning' | 'info'

export type FindingCategory =
  | 'structure'
  | 'missing'
  | 'duplicates'
  | 'categories'
  | 'dates'
  | 'numeric'
  | 'rules'
  | 'crossfield'
  | 'comparison'

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  structure: 'Structure',
  missing: 'Missing values',
  duplicates: 'Duplicates',
  categories: 'Categories',
  dates: 'Dates',
  numeric: 'Numerical values',
  rules: 'Validation rules',
  crossfield: 'Cross-field consistency',
  comparison: 'Dataset comparison',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Information',
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

/** A problem or observation produced by a check. */
export interface Finding {
  id: string
  category: FindingCategory
  severity: Severity
  /** Short, human-readable title. */
  title: string
  /** Plain-language explanation of what was detected and why it matters. */
  explanation: string
  /** Columns the finding refers to (header names). */
  columns: string[]
  /**
   * Affected row numbers, 1-based, counted over data rows only
   * (the header row is not a data row). Empty when not row-specific.
   */
  rows: number[]
  /** The rule or statistical method used to produce this finding. */
  method: string
  /** What the journalist could reasonably do next. */
  nextStep: string
  /** Explicit statement of what the finding does *not* establish. */
  uncertainty?: string
  /** Machine-readable supporting evidence (counts, values, thresholds). */
  evidence?: Record<string, unknown>
}

/** Problems detected while parsing a CSV file. */
export interface ParseIssue {
  code: string
  message: string
  /** 1-based data row number where the issue was observed, when known. */
  row?: number
  /** True when the row was still imported despite the issue. */
  recovered: boolean
}

export interface ParsedTable {
  fileName: string
  fileSizeBytes: number
  delimiter: string
  /** True when the first record was treated as a header row. */
  hasHeader: boolean
  headers: string[]
  /** Data rows, in file order. Blank lines are removed. */
  rows: string[][]
  parseIssues: ParseIssue[]
  /** Text encoding note, e.g. a stripped byte-order mark. */
  notes: string[]
}

export interface ColumnProfile {
  name: string
  index: number
  detectedType: ColumnType
  /** Type currently in use, which may have been set by the user. */
  type: ColumnType
  /** True when the user overrode the detected type. */
  userOverride: boolean
  nonEmptyCount: number
  emptyCount: number
  distinctCount: number
  /** Up to five example values, for inspection. */
  examples: string[]
}

export interface NumericStats {
  column: string
  count: number
  invalidCount: number
  min: number
  max: number
  mean: number
  median: number
  standardDeviation: number
  q1: number
  q3: number
  iqr: number
  lowerFence: number
  upperFence: number
  outlierCount: number
  extremeOutlierCount: number
  negativeCount: number
  zeroCount: number
}

export type DateFormatId =
  | 'YYYY-MM-DD'
  | 'YYYY/MM/DD'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'DD-MM-YYYY'
  | 'MM-DD-YYYY'
  | 'DD.MM.YYYY'
  | 'DD MMM YYYY'
  | 'MMM DD, YYYY'
  | 'ISO_DATETIME'

export const DATE_FORMATS: DateFormatId[] = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'DD.MM.YYYY',
  'DD MMM YYYY',
  'MMM DD, YYYY',
  'ISO_DATETIME',
]

export type RuleKind = 'required' | 'range' | 'unique' | 'allowed' | 'nonnegative'

export const RULE_LABELS: Record<RuleKind, string> = {
  required: 'Column must not be empty',
  range: 'Number must be within a range',
  unique: 'Column must contain unique values',
  allowed: 'Value must belong to a permitted list',
  nonnegative: 'Number must be greater than or equal to zero',
}

export interface ValidationRule {
  id: string
  kind: RuleKind
  column: string
  /** For `range`. */
  min?: number
  max?: number
  /** For `allowed`. */
  allowed?: string[]
  /** For `range`/`nonnegative`: skip empty cells (handled by the `required` rule). */
  ignoreEmpty?: boolean
  /** Human label, auto-generated when omitted. */
  label?: string
  enabled: boolean
}

export type OutlierMethod = 'iqr' | 'zscore'

export interface CrossFieldRule {
  id: string
  label: string
  /** Numeric columns that are summed on the left-hand side of the comparison. */
  components: string[]
  /** Numeric column the sum is compared against. */
  total: string
  tolerance: number
  toleranceMode: 'absolute' | 'percent'
  /** Skip rows where any involved cell is empty. */
  ignoreEmpty: boolean
  enabled: boolean
}

export interface AnalysisSettings {
  /** Columns used to define a potential duplicate. Empty = whole row. */
  duplicateKeyColumns: string[]
  dateFormats: Record<string, DateFormatId>
  /** Whether each date format was chosen by the user or detected. */
  dateFormatSource: Record<string, 'auto' | 'user'>
  outlierMethod: OutlierMethod
  outlierThreshold: number
  rules: ValidationRule[]
  crossFieldRules: CrossFieldRule[]
}

export function defaultSettings(): AnalysisSettings {
  return {
    duplicateKeyColumns: [],
    dateFormats: {},
    dateFormatSource: {},
    outlierMethod: 'iqr',
    outlierThreshold: 1.5,
    rules: [],
    crossFieldRules: [],
  }
}

export interface AnalysisSummary {
  recordCount: number
  columnCount: number
  findingCount: number
  bySeverity: Record<Severity, number>
  byCategory: Partial<Record<FindingCategory, number>>
  affectedRowCount: number
}

export interface AnalysisResult {
  datasetName: string
  generatedAt: string
  settings: AnalysisSettings
  findings: Finding[]
  numericStats: NumericStats[]
  summary: AnalysisSummary
  /** Checks that were executed, recorded verbatim in exports. */
  checksPerformed: string[]
  limitations: string[]
}

/** Dataset comparison ------------------------------------------------------ */

export interface ColumnStructureChange {
  name: string
  change: 'added' | 'removed' | 'type-changed'
  previousType?: ColumnType
  newType?: ColumnType
}

export interface ValueChange {
  column: string
  before: string
  after: string
}

export type RecordChangeKind = 'added' | 'removed' | 'changed' | 'unchanged'

export interface RecordChange {
  kind: RecordChangeKind
  /** Composite key describing the record. */
  key: string
  /** 1-based row number in the older dataset, when present. */
  oldRow?: number
  /** 1-based row number in the newer dataset, when present. */
  newRow?: number
  changes: ValueChange[]
}

export interface ComparisonResult {
  oldName: string
  newName: string
  generatedAt: string
  keyColumns: string[]
  alignment: 'key' | 'row-position'
  columnChanges: ColumnStructureChange[]
  records: RecordChange[]
  counts: {
    added: number
    removed: number
    changed: number
    unchanged: number
  }
  findings: Finding[]
  limitations: string[]
  truncated: boolean
}
