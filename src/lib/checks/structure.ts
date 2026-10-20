import type { ColumnProfile, Finding, ParsedTable } from '../types'
import { capRows } from './helpers'

/**
 * Structural findings: malformed records, empty columns, an empty dataset and
 * the assumptions DataProof made while reading the file. These are reported
 * separately from value-level checks because they concern the shape of the
 * table rather than any single figure.
 */
export function checkStructure(table: ParsedTable, profiles: ColumnProfile[]): Finding[] {
  const findings: Finding[] = []

  // Malformed records detected during parsing.
  const malformed = table.parseIssues.filter((i) => i.code === 'TooFewFields' || i.code === 'TooManyFields')
  if (malformed.length > 0) {
    const rows = malformed.map((i) => i.row).filter((r): r is number => typeof r === 'number')
    const { rows: cappedRows, truncated, total } = capRows(rows)
    findings.push({
      id: 'structure-malformed',
      category: 'structure',
      severity: 'error',
      title: `${malformed.length} row${malformed.length === 1 ? '' : 's'} have a different number of fields from the header`,
      explanation:
        `${malformed.length} record${malformed.length === 1 ? '' : 's'} could not be split into the same number of fields as the ` +
        `header row. This normally means an unescaped delimiter, a missing value in the source export, or a stray line break ` +
        `inside a quoted value. Short rows were padded with empty cells and long rows were truncated for display, so the ` +
        `affected records may be incomplete.`,
      columns: table.headers,
      rows: cappedRows,
      method: 'The number of fields produced for each record is compared with the number of columns in the header row.',
      nextStep:
        'Open the affected rows and compare them with the original file. If the source is a spreadsheet export, check for ' +
        'commas or line breaks inside unquoted cells.',
      uncertainty:
        'DataProof recovered what it could, but a malformed record may have shifted values between columns.',
      evidence: {
        issueCount: malformed.length,
        examples: malformed.slice(0, 20).map((i) => ({ row: i.row, message: i.message })),
        rowsTruncated: truncated,
        affectedRowTotal: total,
      },
    })
  }

  // Quote / parse errors reported by the CSV parser.
  const quoteIssues = table.parseIssues.filter((i) => i.code === 'MissingQuotes' || i.code === 'InvalidQuotes')
  if (quoteIssues.length > 0) {
    findings.push({
      id: 'structure-quotes',
      category: 'structure',
      severity: 'error',
      title: `${quoteIssues.length} quoting problem${quoteIssues.length === 1 ? '' : 's'} found while reading the file`,
      explanation:
        `The parser found an unterminated or malformed quoted field. Everything after the affected position may have been ` +
        `grouped into the wrong cell. This usually means a quotation mark appears inside a value without being doubled ("") ` +
        `or the file uses a different quoting convention.`,
      columns: [],
      rows: quoteIssues.map((i) => i.row).filter((r): r is number => typeof r === 'number'),
      method: 'CSV quoting rules as reported by the PapaParse parser.',
      nextStep: 'Open the affected rows, then check the raw file around those positions and repair the quoting at source.',
      uncertainty: 'The parser reports where the problem was noticed, which is not always where it began.',
      evidence: { examples: quoteIssues.slice(0, 20).map((i) => ({ row: i.row, message: i.message })) },
    })
  }

  // Empty dataset.
  if (table.rows.length === 0) {
    findings.push({
      id: 'structure-empty',
      category: 'structure',
      severity: 'error',
      title: 'The dataset contains no data rows',
      explanation:
        table.headers.length > 0
          ? `The header row was read (${table.headers.length} column${table.headers.length === 1 ? '' : 's'}) but no data rows followed.`
          : 'The file was empty or contained only blank lines.',
      columns: table.headers,
      rows: [],
      method: 'Row count after removing blank lines.',
      nextStep: 'Check that the correct file was selected and that it contains records below the header row.',
      uncertainty: 'A file with a header but no rows is structurally valid CSV, but there is nothing to analyse.',
      evidence: { rowCount: 0, columnCount: table.headers.length },
    })
    return findings
  }

  // Columns that are entirely empty.
  const emptyColumns = profiles.filter((p) => p.nonEmptyCount === 0)
  if (emptyColumns.length > 0) {
    findings.push({
      id: 'structure-empty-columns',
      category: 'structure',
      severity: 'warning',
      title: `${emptyColumns.length} column${emptyColumns.length === 1 ? ' is' : 's are'} completely empty`,
      explanation:
        `Every cell in ${emptyColumns.map((c) => `"${c.name}"`).join(', ')} is empty. A column with no values at all is usually ` +
        `a leftover from an export, a mis-detected delimiter, or a field that was dropped upstream.`,
      columns: emptyColumns.map((c) => c.name),
      rows: [],
      method: 'A column is empty when none of its cells contain characters other than whitespace.',
      nextStep: 'Confirm the column is expected. If it is not, re-check the export settings before analysing further.',
      uncertainty: 'An empty column is not an error by itself; some published files include unused fields deliberately.',
      evidence: { columns: emptyColumns.map((c) => c.name), rowCount: table.rows.length },
    })
  }

  // Column names that carry no information.
  const unnamed = profiles.filter((p) => /^Column \d+$/.test(p.name))
  if (unnamed.length > 0) {
    findings.push({
      id: 'structure-unnamed-columns',
      category: 'structure',
      severity: 'info',
      title: `${unnamed.length} column${unnamed.length === 1 ? '' : 's'} without a header name`,
      explanation:
        `The header row did not supply a usable name for ${unnamed.length} column${unnamed.length === 1 ? '' : 's'}, so ` +
        `${unnamed.length === 1 ? 'it was' : 'they were'} named by position. Findings and exports will refer to these columns by ` +
        `the generated name.`,
      columns: unnamed.map((c) => c.name),
      rows: [],
      method: 'A header cell that is empty, or a file with no detectable header row, produces the name "Column N".',
      nextStep: 'If the file has a header row that was not detected, switch the header toggle on the Analyze screen and re-import.',
      uncertainty: 'The header-row decision is a heuristic; the toggle always overrides it.',
      evidence: { columns: unnamed.map((c) => c.name) },
    })
  }

  // The header-row assumption itself, so it is never invisible.
  findings.push({
    id: 'structure-header-assumption',
    category: 'structure',
    severity: 'info',
    title: table.hasHeader ? 'First record was read as the header row' : 'File was read without a header row',
    explanation: table.hasHeader
      ? `The first record of "${table.fileName}" was treated as column names and is not counted among the ${table.rows.length} data rows. ` +
        `Detected delimiter: ${describeDelimiter(table.delimiter)}.`
      : `No header row was detected, so all ${table.rows.length} records were treated as data and the columns were named by position. ` +
        `Detected delimiter: ${describeDelimiter(table.delimiter)}.`,
    columns: [],
    rows: [],
    method: 'A first record is treated as a header when all its cells are non-empty, unique and none of them parses as a number.',
    nextStep: 'If this is wrong, use the header-row toggle on the Analyze screen and re-import the file.',
    uncertainty: 'Header detection is a heuristic based on the shape of the first record.',
    evidence: {
      hasHeader: table.hasHeader,
      delimiter: table.delimiter,
      rowCount: table.rows.length,
      columnCount: table.headers.length,
    },
  })

  return findings
}

function describeDelimiter(delimiter: string): string {
  if (delimiter === ',') return 'comma'
  if (delimiter === ';') return 'semicolon'
  if (delimiter === '\t') return 'tab'
  if (delimiter === '|') return 'pipe'
  return JSON.stringify(delimiter)
}
