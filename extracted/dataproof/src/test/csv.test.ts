import { describe, expect, it } from 'vitest'
import {
  detectDateFormat,
  detectDelimiter,
  inferColumnType,
  isAmbiguousDate,
  looksLikeHeader,
  mean,
  median,
  normalizeCategory,
  parseCsvText,
  parseDateWithFormat,
  parseNumber,
  quantile,
  standardDeviation,
} from '../lib/csv'

const parse = (csv: string, options = {}) => parseCsvText(csv, 'test.csv', csv.length, options)

describe('CSV parsing', () => {
  it('reads a simple file with a header row', () => {
    const table = parse('name,amount\nWater,100\nHealth,200\n')
    expect(table.headers).toEqual(['name', 'amount'])
    expect(table.rows).toEqual([
      ['Water', '100'],
      ['Health', '200'],
    ])
    expect(table.hasHeader).toBe(true)
    expect(table.parseIssues).toHaveLength(0)
  })

  it('handles quoted fields containing commas', () => {
    const table = parse('name,note\n"Lagos, Nigeria","paid, in full"\n')
    expect(table.rows[0]).toEqual(['Lagos, Nigeria', 'paid, in full'])
  })

  it('handles quoted fields containing newlines', () => {
    const table = parse('name,note\n"Health","line one\nline two"\n')
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0][1]).toBe('line one\nline two')
  })

  it('handles doubled quotes inside a quoted value', () => {
    const table = parse('name\n"say ""hello"""\n')
    expect(table.rows[0][0]).toBe('say "hello"')
  })

  it('handles CRLF line endings', () => {
    const table = parse('a,b\r\n1,2\r\n3,4\r\n')
    expect(table.headers).toEqual(['a', 'b'])
    expect(table.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('removes blank lines without disturbing row numbering', () => {
    const table = parse('a,b\n1,2\n\n3,4\n')
    expect(table.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('strips a UTF-8 byte-order mark', () => {
    const table = parse('\uFEFFa,b\n1,2\n')
    expect(table.headers).toEqual(['a', 'b'])
    expect(table.notes.join(' ')).toMatch(/byte-order mark/i)
  })

  it('flags a row with too many fields and keeps the extra value out of the table', () => {
    const table = parse('a,b\n1,2\n3,4,5\n')
    const issue = table.parseIssues.find((i) => i.code === 'TooManyFields')
    expect(issue).toBeDefined()
    expect(issue?.row).toBe(2)
    expect(table.rows[1]).toEqual(['3', '4'])
  })

  it('flags a row with too few fields and pads it with empty cells', () => {
    const table = parse('a,b,c\n1,2,3\n4,5\n')
    const issue = table.parseIssues.find((i) => i.code === 'TooFewFields')
    expect(issue).toBeDefined()
    expect(issue?.row).toBe(2)
    expect(table.rows[1]).toEqual(['4', '5', ''])
  })

  it('reports an empty file instead of throwing', () => {
    const table = parse('')
    expect(table.headers).toEqual([])
    expect(table.rows).toEqual([])
    expect(table.parseIssues[0].code).toBe('EmptyFile')
  })

  it('reports a file that contains only blank lines', () => {
    const table = parse('\n\n   \n')
    expect(table.rows).toHaveLength(0)
    expect(table.parseIssues.some((i) => i.code === 'EmptyFile' || i.code === 'NoRecords')).toBe(true)
  })

  it('reports duplicate header names', () => {
    const table = parse('a,a\n1,2\n')
    expect(table.parseIssues.some((i) => i.code === 'DuplicateHeader')).toBe(true)
  })

  it('names columns by position when there is no header row', () => {
    const table = parse('1,2\n3,4\n')
    expect(table.hasHeader).toBe(false)
    expect(table.headers).toEqual(['Column 1', 'Column 2'])
    expect(table.rows).toHaveLength(2)
  })

  it('honours an explicit header setting', () => {
    const table = parse('name,amount\nWater,100\n', { hasHeader: false })
    expect(table.headers).toEqual(['Column 1', 'Column 2'])
    expect(table.rows).toHaveLength(2)
  })
})

describe('delimiter detection', () => {
  it('detects commas, semicolons, tabs and pipes', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n')).toBe(',')
    expect(detectDelimiter('a;b;c\n1;2;3\n')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t')
    expect(detectDelimiter('a|b|c\n1|2|3\n')).toBe('|')
  })

  it('is not confused by commas inside quoted values', () => {
    const csv = 'name;note\n"Lagos, Nigeria";paid\n'
    expect(detectDelimiter(csv)).toBe(';')
  })

  it('parses a semicolon file end to end', () => {
    const table = parse('name;amount\nWater;100\n')
    expect(table.delimiter).toBe(';')
    expect(table.rows[0]).toEqual(['Water', '100'])
  })
})

describe('header detection', () => {
  it('recognises a textual first row', () => {
    expect(looksLikeHeader(['Department', 'Amount'])).toBe(true)
  })

  it('does not treat a numeric first row as a header', () => {
    expect(looksLikeHeader(['1', '2'])).toBe(false)
  })

  it('does not treat a row with empty cells as a header', () => {
    expect(looksLikeHeader(['Department', ''])).toBe(false)
  })
})

describe('number parsing', () => {
  it('reads plain integers and decimals', () => {
    expect(parseNumber('42')).toBe(42)
    expect(parseNumber('-3.5')).toBe(-3.5)
    expect(parseNumber('1.2e3')).toBe(1200)
  })

  it('reads grouped thousands', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5)
    expect(parseNumber('1 234 567')).toBe(1234567)
  })

  it('rejects an invalid grouping rather than guessing', () => {
    expect(parseNumber('1,23')).toBeNull()
    expect(parseNumber('12,34')).toBeNull()
  })

  it('reads accounting parentheses as negative', () => {
    expect(parseNumber('(1,200)')).toBe(-1200)
  })

  it('reads currency prefixes and percent signs without altering the magnitude', () => {
    expect(parseNumber('$1,000')).toBe(1000)
    expect(parseNumber('NGN 500')).toBe(500)
    expect(parseNumber('45%')).toBe(45)
  })

  it('treats leading zeros as text so identifiers survive', () => {
    expect(parseNumber('007')).toBeNull()
    expect(parseNumber('0012')).toBeNull()
  })

  it('returns null for empty and non-numeric values', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
    expect(parseNumber('n/a')).toBeNull()
    expect(parseNumber('not reported')).toBeNull()
  })

  it('preserves an explicit zero', () => {
    expect(parseNumber('0')).toBe(0)
    expect(parseNumber('0.00')).toBe(0)
  })
})

describe('column type inference', () => {
  it('detects numbers, text and booleans', () => {
    expect(inferColumnType(['1', '2', '3'])).toBe('number')
    expect(inferColumnType(['Lagos', 'Kano'])).toBe('text')
    expect(inferColumnType(['true', 'false'])).toBe('boolean')
  })

  it('detects a date column', () => {
    expect(inferColumnType(['2023-01-01', '2023-04-01'])).toBe('date')
  })

  it('reports an all-empty column as unknown', () => {
    expect(inferColumnType(['', '  ', ''])).toBe('unknown')
  })

  it('does not call an identifier column numeric', () => {
    expect(inferColumnType(['AN-001-01-001', 'AN-002-01-001'])).toBe('text')
  })
})

describe('date parsing', () => {
  it('parses ISO dates', () => {
    expect(parseDateWithFormat('2024-02-29', 'YYYY-MM-DD')).not.toBeNull()
  })

  it('rejects impossible dates', () => {
    expect(parseDateWithFormat('2024-02-31', 'YYYY-MM-DD')).toBeNull()
    expect(parseDateWithFormat('29/02/2023', 'DD/MM/YYYY')).toBeNull()
    expect(parseDateWithFormat('31/04/2024', 'DD/MM/YYYY')).toBeNull()
  })

  it('applies the requested convention rather than guessing', () => {
    const dayFirst = parseDateWithFormat('03/04/2024', 'DD/MM/YYYY')
    const monthFirst = parseDateWithFormat('03/04/2024', 'MM/DD/YYYY')
    expect(dayFirst?.toISOString().slice(0, 10)).toBe('2024-04-03')
    expect(monthFirst?.toISOString().slice(0, 10)).toBe('2024-03-04')
  })

  it('parses month names', () => {
    expect(parseDateWithFormat('14 Jan 2024', 'DD MMM YYYY')?.toISOString().slice(0, 10)).toBe('2024-01-14')
    expect(parseDateWithFormat('Jan 14, 2024', 'MMM DD, YYYY')?.toISOString().slice(0, 10)).toBe('2024-01-14')
  })

  it('detects the format that fits most values', () => {
    expect(detectDateFormat(['2023-01-01', '2023-04-01']).bestFormat).toBe('YYYY-MM-DD')
    expect(detectDateFormat(['01/02/2023', '05/06/2023', '31/12/2023']).bestFormat).toBe('DD/MM/YYYY')
  })

  it('identifies ambiguous values', () => {
    expect(isAmbiguousDate('03/04/2024')).toBe(true)
    expect(isAmbiguousDate('2024-04-03')).toBe(false)
    expect(isAmbiguousDate('25/12/2024')).toBe(false)
  })
})

describe('text normalisation', () => {
  it('collapses case and whitespace only', () => {
    expect(normalizeCategory('  Lagos  ')).toBe('lagos')
    expect(normalizeCategory('LAGOS')).toBe('lagos')
    expect(normalizeCategory('Lagos State')).toBe('lagos state')
    expect(normalizeCategory('Lagos (FCT)')).toBe('lagos (fct)')
  })
})

describe('statistics helpers', () => {
  it('computes the median with linear interpolation', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([5])).toBe(5)
  })

  it('computes the mean', () => {
    expect(mean([1, 2, 3])).toBe(2)
  })

  it('computes the sample standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3)
    expect(standardDeviation([7])).toBe(0)
  })

  it('computes quantiles', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2)
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4)
  })
})
