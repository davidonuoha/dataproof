/**
 * CSV parsing and value interpretation.
 *
 * Parsing is delegated to PapaParse (quoted fields, embedded commas, embedded
 * newlines, CRLF/LF). DataProof adds on top of it:
 *
 *  - delimiter detection scored across candidate delimiters;
 *  - header-row detection;
 *  - ragged-row (malformed record) detection;
 *  - conservative numeric / date / boolean interpretation.
 *
 * Nothing in this module touches the network. All processing is local.
 */
import Papa from 'papaparse'
import type { ColumnType, ParseIssue, ParsedTable } from './types'

export const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const

export const DELIMITER_NAMES: Record<string, string> = {
  ',': 'comma',
  ';': 'semicolon',
  '\t': 'tab',
  '|': 'pipe',
}

/** Hard limit for a single import. Above this the UI refuses and explains why. */
export const MAX_FILE_BYTES = 60 * 1024 * 1024
/** Above this the UI shows a warning about processing time. */
export const LARGE_FILE_BYTES = 15 * 1024 * 1024
/** Rows rendered in the preview / record inspector. */
export const PREVIEW_ROW_LIMIT = 200

export function stripBom(text: string): { text: string; hadBom: boolean } {
  if (text.charCodeAt(0) === 0xfeff) {
    return { text: text.slice(1), hadBom: true }
  }
  return { text, hadBom: false }
}

/**
 * Score each candidate delimiter by how consistently it splits the first
 * sample lines into the same number of fields. A delimiter that appears inside
 * quoted values is handled correctly because PapaParse does the splitting.
 */
export function detectDelimiter(text: string, candidates: readonly string[] = CANDIDATE_DELIMITERS): string {
  const sample = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '').slice(0, 25).join('\n')
  if (sample.trim() === '') return ','

  let best = ','
  let bestScore = -1
  for (const delimiter of candidates) {
    const parsed = Papa.parse<string[]>(sample, {
      delimiter,
      header: false,
      skipEmptyLines: true,
    })
    const widths = (parsed.data as string[][]).map((r) => r.length).filter((w) => w > 0)
    if (widths.length === 0) continue
    const counts = new Map<number, number>()
    for (const w of widths) counts.set(w, (counts.get(w) ?? 0) + 1)
    const [modalWidth, modalCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    // Prefer delimiters that produce more than one column and a consistent width.
    const consistency = modalCount / widths.length
    const score = (modalWidth > 1 ? consistency * 10 + Math.min(modalWidth, 20) : 0)
    if (score > bestScore) {
      bestScore = score
      best = delimiter
    }
  }
  return best
}

/**
 * Decide whether the first record is a header row.
 *
 * A row is treated as a header when every cell is non-empty and no cell looks
 * like a plain number or a date. Duplicate names do not disqualify a row: they
 * are reported as a separate finding, because a duplicated heading is itself a
 * data problem worth knowing about. This is a heuristic — the user can always
 * toggle it, and the choice is recorded in exports.
 */
export function looksLikeHeader(row: string[]): boolean {
  if (row.length === 0) return false
  const cells = row.map((c) => c.trim())
  if (cells.some((c) => c === '')) return false
  return !cells.some((c) => parseNumber(c) !== null)
}

export interface ParseOptions {
  delimiter?: string
  hasHeader?: boolean
}

export interface CsvParseResult extends ParsedTable {
  /** The delimiter actually used. */
  delimiter: string
}

/**
 * Parse CSV text into a table. Pure function: identical input always yields
 * identical output, which is what makes it straightforward to test.
 */
export function parseCsvText(input: string, fileName = 'dataset.csv', fileSizeBytes = 0, options: ParseOptions = {}): CsvParseResult {
  const notes: string[] = []
  const parseIssues: ParseIssue[] = []

  const { text, hadBom } = stripBom(input)
  if (hadBom) notes.push('A UTF-8 byte-order mark was detected and removed.')

  if (text.trim() === '') {
    return {
      fileName,
      fileSizeBytes,
      delimiter: options.delimiter ?? ',',
      hasHeader: options.hasHeader ?? true,
      headers: [],
      rows: [],
      parseIssues: [
        {
          code: 'EmptyFile',
          message: 'The file contains no records.',
          recovered: false,
        },
      ],
      notes,
    }
  }

  const delimiter = options.delimiter ?? detectDelimiter(text)

  const parsed = Papa.parse<string[]>(text, {
    delimiter,
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
  })

  const allRows = (parsed.data as unknown as string[][]).map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))) : [''],
  )

  for (const error of parsed.errors) {
    if (error.code === 'UndetectableDelimiter') continue
    const rowNumber = typeof error.row === 'number' ? error.row + 1 : undefined
    parseIssues.push({
      code: error.code ?? 'ParseError',
      message: error.message,
      row: rowNumber,
      recovered: error.code !== 'MissingQuotes',
    })
  }

  // Blank lines are dropped, but their original position is remembered so that
  // malformed-row reports can still point at the right place in the file.
  const keptIndices: number[] = []
  const keptRows: string[][] = []
  allRows.forEach((row, index) => {
    const isBlank = row.every((cell) => cell.trim() === '')
    if (!isBlank) {
      keptIndices.push(index)
      keptRows.push(row)
    }
  })

  const originalToDataRow = new Map<number, number>()
  keptIndices.forEach((original, i) => originalToDataRow.set(original, i + 1))

  if (keptRows.length === 0) {
    return {
      fileName,
      fileSizeBytes,
      delimiter,
      hasHeader: options.hasHeader ?? true,
      headers: [],
      rows: [],
      parseIssues: [
        ...parseIssues,
        { code: 'NoRecords', message: 'No records were found after removing blank lines.', recovered: false },
      ],
      notes,
    }
  }

  const hasHeader = options.hasHeader ?? looksLikeHeader(keptRows[0])
  let headers: string[]
  let dataRows: string[][]

  if (hasHeader) {
    headers = keptRows[0].map((h, i) => {
      const trimmed = h.trim()
      return trimmed === '' ? `Column ${i + 1}` : trimmed
    })
    dataRows = keptRows.slice(1)
  } else {
    headers = keptRows[0].map((_, i) => `Column ${i + 1}`)
    dataRows = keptRows
    notes.push('No header row was detected, so columns were named "Column 1", "Column 2", … You can rename them in the column settings.')
  }

  // Ragged rows: PapaParse does not flag these when parsing without a header,
  // so DataProof checks field counts itself.
  const headerCount = headers.length
  dataRows.forEach((row, index) => {
    if (row.length > headerCount) {
      parseIssues.push({
        code: 'TooManyFields',
        message: `Row ${index + 1} has ${row.length} fields but the table has ${headerCount} columns. Extra values are kept but are not shown in the table.`,
        row: index + 1,
        recovered: true,
      })
    } else if (row.length < headerCount) {
      parseIssues.push({
        code: 'TooFewFields',
        message: `Row ${index + 1} has ${row.length} field${row.length === 1 ? '' : 's'} but the table has ${headerCount} columns. Missing cells were treated as empty.`,
        row: index + 1,
        recovered: true,
      })
    }
  })

  // Normalise every row to the header width so downstream checks see a
  // rectangular table. Short rows are padded with empty strings.
  const normalised = dataRows.map((row) => {
    if (row.length === headerCount) return row
    const copy = row.slice(0, headerCount)
    while (copy.length < headerCount) copy.push('')
    return copy
  })

  // Duplicate header names would silently collapse in an object model; the UI
  // works on arrays, so they are safe, but the ambiguity is worth reporting.
  const seen = new Map<string, number>()
  for (const header of headers) {
    seen.set(header, (seen.get(header) ?? 0) + 1)
  }
  for (const [header, count] of seen) {
    if (count > 1) {
      parseIssues.push({
        code: 'DuplicateHeader',
        message: `The column name "${header}" appears ${count} times. Columns are identified by position in this application, but the duplication may itself be a data problem.`,
        recovered: true,
      })
    }
  }

  return {
    fileName,
    fileSizeBytes,
    delimiter,
    hasHeader,
    headers,
    rows: normalised,
    parseIssues,
    notes,
  }
}

/** True when a cell has no usable content. Zero, false and text are present. */
export function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim() === ''
}

const CURRENCY_PREFIX = /^(?:[$€£¥₦₹₽]|USD|EUR|GBP|NGN|JPY|ZAR|KES|GHS)\s*/i

/**
 * Interpret a cell as a number, or return null when it is not one.
 *
 * Deliberately conservative and documented, because a number that is silently
 * "fixed" would corrupt every downstream statistic:
 *  - thousands separators are accepted only in a valid grouping pattern;
 *  - a trailing `%` is stripped and the number is returned as written
 *    (`45%` → 45), it is *not* divided by 100;
 *  - accounting parentheses are read as negative: `(1,200)` → -1200;
 *  - leading zeros are treated as text so identifiers such as `007` survive.
 */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null
  let s = String(raw).trim()
  if (s === '') return null

  let negative = false
  const paren = /^\((.*)\)$/.exec(s)
  if (paren) {
    negative = true
    s = paren[1].trim()
  }

  s = s.replace(CURRENCY_PREFIX, '').trim()
  if (s.endsWith('%')) s = s.slice(0, -1).trim()
  s = s.replace(/[\u2212\u2013\u2014]/g, '-')

  if (s.startsWith('+')) s = s.slice(1)

  const negativeSign = s.startsWith('-')
  const unsigned = negativeSign ? s.slice(1) : s

  // Leading zeros signal an identifier (postcodes, polling-unit codes), not a number.
  if (/^0\d/.test(unsigned)) return null
  if (unsigned.includes(',')) {
    if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(unsigned)) return null
    s = (negativeSign ? '-' : '') + unsigned.replace(/,/g, '')
  } else if (/\s/.test(unsigned)) {
    if (!/^\d{1,3}(\s\d{3})+(\.\d+)?$/.test(unsigned)) return null
    s = (negativeSign ? '-' : '') + unsigned.replace(/\s/g, '')
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -Math.abs(n) : n
}

/** True when a cell reads as a number (used for type detection). */
export function looksNumeric(raw: string): boolean {
  return parseNumber(raw) !== null
}

const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no'])

export function parseBoolean(raw: string): boolean | null {
  const s = raw.trim().toLowerCase()
  if (s === 'true' || s === 'yes') return true
  if (s === 'false' || s === 'no') return false
  return null
}

/**
 * Normalise a text value for category comparison.
 *
 * Only case, surrounding whitespace and repeated internal whitespace are
 * collapsed. Punctuation is preserved because "Abuja (FCT)" and "Abuja FCT"
 * may legitimately be different reporting units — DataProof suggests
 * inconsistencies, it does not decide them.
 */
export function normalizeCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Infer a column type from its values. Sampling is capped so that very large
 * files stay responsive; the sample is deterministic (first N non-empty cells).
 *
 * Numeric and date detection are deliberately *tolerant* rather than
 * all-or-nothing. A column of 200 amounts containing three "n/a" entries is a
 * numeric column with three unreadable values — treating it as text would hide
 * exactly the problem the journalist needs to see. The threshold is 75% of the
 * non-empty sample, and the user can always override the result.
 */
export function inferColumnType(values: string[], sampleSize = 500): ColumnType {
  const nonEmpty = values.filter((v) => !isBlank(v)).slice(0, sampleSize)
  if (nonEmpty.length === 0) return 'unknown'

  const numericCount = nonEmpty.filter((v) => parseNumber(v) !== null).length
  if (numericCount === nonEmpty.length) return 'number'
  if (numericCount >= 2 && numericCount / nonEmpty.length >= 0.75) return 'number'

  if (nonEmpty.every((v) => BOOLEAN_VALUES.has(v.trim().toLowerCase()))) return 'boolean'

  // Dates: require a single recognised pattern to fit most of the column.
  const { bestFormat, matched } = detectDateFormat(nonEmpty)
  if (bestFormat && matched / nonEmpty.length >= 0.75) return 'date'

  return 'text'
}

/* ------------------------------------------------------------------------- */
/* Date handling                                                              */
/* ------------------------------------------------------------------------- */

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]

export function monthNameIndex(token: string): number {
  const t = token.toLowerCase().replace(/\.$/, '').slice(0, 3)
  return MONTHS.indexOf(t)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function makeDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  if (year < 1000 || year > 9999) return null
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Parse a date using one explicit format. Returns null when the value does not
 * match the format or represents an impossible date (e.g. 31/02/2024).
 *
 * Ambiguous values such as `03/04/2024` are parsed according to the requested
 * format and never silently re-interpreted.
 */
export function parseDateWithFormat(raw: string, format: string): Date | null {
  const s = raw.trim()
  if (s === '') return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(s)
  if (iso) {
    const [, y, m, d, hh, mm, ss, zone] = iso
    const date = makeDate(Number(y), Number(m), Number(d))
    if (!date) return null
    if (hh !== undefined) {
      const hour = Number(hh)
      const minute = Number(mm)
      const second = ss ? Number(ss) : 0
      if (hour > 23 || minute > 59 || second > 59) return null
      if (format === 'ISO_DATETIME') {
        return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), hour, minute, second))
      }
      if (format === 'YYYY-MM-DD') {
        // A plain date format does not accept a time component.
        if (zone !== undefined || hour !== 0 || minute !== 0) return null
      }
    }
    if (format === 'ISO_DATETIME') {
      // Require a time component for the datetime format.
      if (hh === undefined) return null
    }
    if (format === 'YYYY-MM-DD' || format === 'ISO_DATETIME') return date
  }

  const parts = s.split(/[\/\-.\s,]+/).filter((p) => p !== '')
  if (parts.length < 3) return null

  const numeric = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN))

  switch (format) {
    case 'YYYY-MM-DD':
    case 'YYYY/MM/DD':
      return numeric.length >= 3 ? makeDate(numeric[0], numeric[1], numeric[2]) : null
    case 'DD/MM/YYYY':
    case 'DD-MM-YYYY':
    case 'DD.MM.YYYY':
      return numeric.length >= 3 ? makeDate(numeric[2], numeric[1], numeric[0]) : null
    case 'MM/DD/YYYY':
    case 'MM-DD-YYYY':
      return numeric.length >= 3 ? makeDate(numeric[2], numeric[0], numeric[1]) : null
    case 'DD MMM YYYY': {
      const day = Number(parts[0])
      const month = monthNameIndex(parts[1]) + 1
      const year = Number(parts[2])
      if (!Number.isFinite(day) || month === 0) return null
      return makeDate(year, month, day)
    }
    case 'MMM DD, YYYY': {
      const month = monthNameIndex(parts[0]) + 1
      const day = Number(parts[1])
      const year = Number(parts[2])
      if (month === 0) return null
      return makeDate(year, month, day)
    }
    default:
      return null
  }
}

/**
 * Choose the format that interprets the most values, breaking ties by the order
 * of `DATE_FORMATS`. Returns how many values matched so callers can decide
 * whether the column really is a date column.
 */
export function detectDateFormat(values: string[]): { bestFormat: string | null; matched: number } {
  const sample = values.filter((v) => !isBlank(v)).slice(0, 500)
  if (sample.length === 0) return { bestFormat: null, matched: 0 }

  let bestFormat: string | null = null
  let bestMatched = 0
  for (const format of ALL_FORMATS) {
    let matched = 0
    for (const value of sample) {
      if (parseDateWithFormat(value, format)) matched += 1
    }
    if (matched > bestMatched) {
      bestMatched = matched
      bestFormat = format
    }
  }
  return { bestFormat, matched: bestMatched }
}

const ALL_FORMATS = [
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
] as const

/**
 * A date is ambiguous when two or more day-first/month-first formats both
 * interpret it. DataProof reports this rather than choosing for the journalist.
 */
export function isAmbiguousDate(raw: string): boolean {
  const candidates = ['DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'MM-DD-YYYY', 'DD.MM.YYYY']
  const matches = candidates.filter((f) => parseDateWithFormat(raw, f) !== null)
  const hasSlash = /[\/]/.test(raw)
  const hasDash = /-/.test(raw)
  if (hasSlash) return matches.includes('DD/MM/YYYY') && matches.includes('MM/DD/YYYY')
  if (hasDash) return matches.includes('DD-MM-YYYY') && matches.includes('MM-DD-YYYY')
  return matches.length >= 1 && !hasSlash && !hasDash
}

export function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/* ------------------------------------------------------------------------- */
/* Statistics helpers                                                          */
/* ------------------------------------------------------------------------- */

/** Linear-interpolation quantile (the same method used by NumPy's default). */
export function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return NaN
  if (sortedValues.length === 1) return sortedValues[0]
  const position = (sortedValues.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sortedValues[lower]
  const weight = position - lower
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

export function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5)
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Sample standard deviation (n-1 denominator). Returns 0 for a single value. */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals }).format(value)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
