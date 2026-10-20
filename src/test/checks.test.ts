import { describe, expect, it } from 'vitest'
import { runAnalysis } from '../lib/analyze'
import { parseCsvText } from '../lib/csv'
import { buildColumnProfiles } from '../lib/profile'
import { checkCategoryConsistency } from '../lib/checks/categories'
import { checkCrossField } from '../lib/checks/crossfield'
import { checkExactDuplicates, checkKeyDuplicates } from '../lib/checks/duplicates'
import { checkMissingValues } from '../lib/checks/missing'
import { checkNumeric, computeNumericStats } from '../lib/checks/numeric'
import { checkRules } from '../lib/checks/rules'
import { checkDates } from '../lib/checks/dates'
import { defaultSettings, type AnalysisSettings, type ParsedTable, type ValidationRule } from '../lib/types'

function tableOf(csv: string): ParsedTable {
  return parseCsvText(csv, 'test.csv', csv.length, {})
}

function settingsWith(patch: Partial<AnalysisSettings>): AnalysisSettings {
  return { ...defaultSettings(), ...patch }
}

describe('missing values', () => {
  const table = tableOf('name,amount,flag\nA,100,true\nB,,false\nC,0,\nD,,\n')

  it('counts only genuinely empty cells', () => {
    const findings = checkMissingValues(table, buildColumnProfiles(table))
    const summary = findings.find((f) => f.id === 'missing-summary')
    // amount: 2 empty (B and D). flag: 2 empty (C and D). name: none.
    expect(summary?.evidence?.totalMissing).toBe(4)
  })

  it('does not treat zero or false as missing', () => {
    const findings = checkMissingValues(table, buildColumnProfiles(table))
    const amount = findings.find((f) => f.id === 'missing-amount')
    expect(amount?.rows).toEqual([2, 4])
    const flag = findings.find((f) => f.id === 'missing-flag')
    expect(flag?.rows).toEqual([3, 4])
  })

  it('reports the affected row numbers and the percentage', () => {
    const findings = checkMissingValues(table, buildColumnProfiles(table))
    const amount = findings.find((f) => f.id === 'missing-amount')
    expect(amount?.evidence?.missingPercent).toBe(50)
    expect(amount?.severity).toBe('warning')
  })

  it('produces no missing finding when every cell is populated', () => {
    const clean = tableOf('a,b\n1,2\n0,false\n')
    expect(checkMissingValues(clean, buildColumnProfiles(clean))).toHaveLength(0)
  })
})

describe('duplicate detection', () => {
  it('finds exactly identical rows and reports their row numbers', () => {
    const table = tableOf('a,b\n1,2\n3,4\n1,2\n')
    const findings = checkExactDuplicates(table)
    expect(findings).toHaveLength(1)
    expect(findings[0].rows).toEqual([1, 3])
    expect(findings[0].severity).toBe('warning')
  })

  it('does not treat rows that differ in any column as exact duplicates', () => {
    const table = tableOf('a,b\n1,2\n1,3\n')
    expect(checkExactDuplicates(table)).toHaveLength(0)
  })

  it('groups rows by a user-selected key', () => {
    const table = tableOf('id,value\nA,1\nA,2\nB,3\n')
    const findings = checkKeyDuplicates(table, ['id'])
    expect(findings).toHaveLength(1)
    expect(findings[0].rows).toEqual([1, 2])
    expect(findings[0].evidence?.keyColumns).toEqual(['id'])
  })

  it('produces no key-duplicate finding when no key is selected', () => {
    const table = tableOf('id,value\nA,1\nA,2\n')
    expect(checkKeyDuplicates(table, [])).toHaveLength(0)
  })

  it('never deletes or modifies rows', () => {
    const table = tableOf('a,b\n1,2\n1,2\n')
    const before = JSON.stringify(table.rows)
    checkExactDuplicates(table)
    expect(JSON.stringify(table.rows)).toBe(before)
  })
})

describe('category consistency', () => {
  it('groups values that differ only by case or whitespace', () => {
    const table = tableOf('state\nLagos\nlagos\nLAGOS\nKano\n')
    const findings = checkCategoryConsistency(table, buildColumnProfiles(table))
    expect(findings).toHaveLength(1)
    expect(findings[0].rows).toEqual([1, 2, 3])
    expect(findings[0].severity).toBe('warning')
    expect(findings[0].uncertainty).toBeTruthy()
  })

  it('does not merge genuinely different values', () => {
    const table = tableOf('state\nLagos\nKano\nAbuja\n')
    expect(checkCategoryConsistency(table, buildColumnProfiles(table))).toHaveLength(0)
  })

  it('preserves the original values in the evidence', () => {
    const table = tableOf('state\nLagos\nlagos\n')
    const findings = checkCategoryConsistency(table, buildColumnProfiles(table))
    const groups = findings[0].evidence?.groups as Array<{ variants: Array<{ value: string }> }>
    expect(groups[0].variants.map((v) => v.value).sort()).toEqual(['Lagos', 'lagos'])
  })
})

describe('date validation', () => {
  const csv = 'period\n2023-01-01\n2023-02-30\nnot a date\n2023-04-01\n'

  it('reports values that do not match the selected format', () => {
    const table = tableOf(csv)
    // Selecting a date column is a user action: the column type is set by hand.
    const profiles = buildColumnProfiles(table, { period: 'date' })
    const settings = settingsWith({
      dateFormats: { period: 'YYYY-MM-DD' },
      dateFormatSource: { period: 'user' },
    })
    const findings = checkDates(table, profiles, settings)
    const invalid = findings.find((f) => f.id === 'dates-invalid-period')
    expect(invalid?.rows).toEqual([2, 3])
    // The format was chosen by the user, so a violation is an error.
    expect(invalid?.severity).toBe('error')
  })

  it('downgrades to a warning when the format was only detected', () => {
    const table = tableOf(csv)
    const profiles = buildColumnProfiles(table, { period: 'date' })
    const settings = settingsWith({ dateFormats: { period: 'YYYY-MM-DD' } })
    const findings = checkDates(table, profiles, settings)
    expect(findings.find((f) => f.id === 'dates-invalid-period')?.severity).toBe('warning')
  })

  it('detects a mostly-valid date column automatically so the bad value is reported', () => {
    const table = tableOf('period\n2023-01-01\n2023-04-01\n2023-07-01\nnot a date\n')
    const profiles = buildColumnProfiles(table)
    expect(profiles[0].type).toBe('date')
    const settings = settingsWith({ dateFormats: { period: 'YYYY-MM-DD' } })
    const findings = checkDates(table, profiles, settings)
    expect(findings.find((f) => f.id === 'dates-invalid-period')?.rows).toEqual([4])
  })

  it('reports ambiguity without changing the value', () => {
    const table = tableOf('period\n03/04/2024\n05/06/2024\n')
    const profiles = buildColumnProfiles(table, { period: 'date' })
    const settings = settingsWith({
      dateFormats: { period: 'DD/MM/YYYY' },
      dateFormatSource: { period: 'user' },
    })
    const findings = checkDates(table, profiles, settings)
    const ambiguous = findings.find((f) => f.id === 'dates-ambiguous-period')
    expect(ambiguous?.severity).toBe('info')
    expect(ambiguous?.rows).toEqual([1, 2])
  })

  it('asks for a format rather than guessing one', () => {
    const table = tableOf('period\n2023-01-01\n')
    const findings = checkDates(table, buildColumnProfiles(table), defaultSettings())
    expect(findings.some((f) => f.id === 'dates-noformat-period')).toBe(true)
  })
})

describe('numerical validation', () => {
  const csv = 'value\n1\n2\n3\n4\n100\nnot a number\n-5\n'
  const table = tableOf(csv)

  it('computes descriptive statistics over the values that parse', () => {
    const stats = computeNumericStats(table, buildColumnProfiles(table), defaultSettings())
    expect(stats).toHaveLength(1)
    expect(stats[0].count).toBe(6)
    expect(stats[0].invalidCount).toBe(1)
    expect(stats[0].min).toBe(-5)
    expect(stats[0].max).toBe(100)
  })

  it('reports values that cannot be read as numbers', () => {
    const stats = computeNumericStats(table, buildColumnProfiles(table), defaultSettings())
    const findings = checkNumeric(table, buildColumnProfiles(table), stats, defaultSettings())
    const invalid = findings.find((f) => f.id === 'numeric-invalid-value')
    expect(invalid?.rows).toEqual([6])
    expect(invalid?.severity).toBe('warning')
  })

  it('flags outliers without calling them errors', () => {
    const stats = computeNumericStats(table, buildColumnProfiles(table), defaultSettings())
    const findings = checkNumeric(table, buildColumnProfiles(table), stats, defaultSettings())
    const outliers = findings.find((f) => f.id === 'numeric-outliers-value')
    expect(outliers).toBeDefined()
    expect(outliers?.severity).toBe('warning')
    expect(outliers?.uncertainty).toMatch(/never labelled incorrect/i)
    expect(outliers?.rows).toContain(5)
  })

  it('records zero as data rather than as missing', () => {
    const zeroTable = tableOf('value\n0\n1\n2\n')
    const stats = computeNumericStats(zeroTable, buildColumnProfiles(zeroTable), defaultSettings())
    expect(stats[0].zeroCount).toBe(1)
    const findings = checkNumeric(zeroTable, buildColumnProfiles(zeroTable), stats, defaultSettings())
    expect(findings.some((f) => f.id === 'numeric-zeros-value')).toBe(true)
    expect(findings.some((f) => f.id === 'numeric-invalid-value')).toBe(false)
  })

  it('uses the z-score method when selected', () => {
    const wide = tableOf('value\n' + Array.from({ length: 20 }, (_, i) => i + 1).join('\n') + '\n500\n')
    const settings = settingsWith({ outlierMethod: 'zscore', outlierThreshold: 2 })
    const stats = computeNumericStats(wide, buildColumnProfiles(wide), settings)
    const findings = checkNumeric(wide, buildColumnProfiles(wide), stats, settings)
    const outliers = findings.find((f) => f.id === 'numeric-outliers-value')
    expect(outliers?.evidence?.method).toBe('zscore')
    expect(outliers?.rows).toContain(21)
  })
})

describe('user-defined validation rules', () => {
  const table = tableOf('amount,code\n5,X\n-1,Y\n200,Z\n,Q\n')

  const rule = (patch: Partial<ValidationRule>): ValidationRule => ({
    id: 'r1',
    kind: 'required',
    column: 'amount',
    enabled: true,
    ...patch,
  })

  it('enforces a required column', () => {
    const findings = checkRules(table, [rule({ kind: 'required' })])
    expect(findings[0].rows).toEqual([4])
    expect(findings[0].severity).toBe('error')
  })

  it('enforces a numeric range', () => {
    const findings = checkRules(table, [rule({ kind: 'range', min: 0, max: 100, ignoreEmpty: true })])
    expect(findings[0].rows).toEqual([2, 3])
  })

  it('enforces non-negative values and reports the reason', () => {
    const findings = checkRules(table, [rule({ kind: 'nonnegative', ignoreEmpty: true })])
    expect(findings[0].rows).toEqual([2])
    const examples = findings[0].evidence?.examples as Array<{ reason: string }>
    expect(examples[0].reason).toBe('negative')
  })

  it('enforces uniqueness', () => {
    const dupes = tableOf('code\nX\nX\nY\n')
    const findings = checkRules(dupes, [rule({ kind: 'unique', column: 'code' })])
    expect(findings[0].rows).toEqual([1, 2])
  })

  it('enforces a permitted list case-insensitively', () => {
    const codes = tableOf('code\nX\nx\nY\nQ\n')
    const findings = checkRules(codes, [rule({ kind: 'allowed', column: 'code', allowed: ['X', 'Y'] })])
    expect(findings[0].rows).toEqual([4])
  })

  it('skips disabled rules', () => {
    expect(checkRules(table, [rule({ kind: 'required', enabled: false })])).toHaveLength(0)
  })

  it('reports nothing when the rule holds', () => {
    const good = tableOf('amount\n1\n2\n3\n')
    expect(checkRules(good, [rule({ kind: 'range', min: 0, max: 10 })])).toHaveLength(0)
  })
})

describe('cross-field consistency', () => {
  const table = tableOf('a,b,total\n10,20,30\n5,5,11\n1,2,3\n')

  const comparison = {
    id: 'x1',
    label: '',
    components: ['a', 'b'],
    total: 'total',
    tolerance: 0,
    toleranceMode: 'absolute' as const,
    ignoreEmpty: true,
    enabled: true,
  }

  it('reports rows where the stated relationship fails', () => {
    const findings = checkCrossField(table, [comparison])
    expect(findings).toHaveLength(1)
    expect(findings[0].rows).toEqual([2])
    expect(findings[0].severity).toBe('error')
  })

  it('states the formula in words', () => {
    const findings = checkCrossField(table, [comparison])
    expect(findings[0].method).toContain('"a" + "b" should equal "total"')
  })

  it('accepts a difference inside the tolerance', () => {
    const findings = checkCrossField(table, [{ ...comparison, tolerance: 1 }])
    expect(findings).toHaveLength(0)
  })

  it('supports a percentage tolerance', () => {
    const findings = checkCrossField(table, [{ ...comparison, tolerance: 20, toleranceMode: 'percent' }])
    expect(findings).toHaveLength(0)
  })

  it('does not assume any relationship that was not defined', () => {
    expect(checkCrossField(table, [])).toHaveLength(0)
  })
})

describe('analysis orchestration', () => {
  it('sorts findings by severity and summarises them', () => {
    const table = tableOf('name,amount\nA,1\nA,1\nB,\nC,5000\n')
    const profiles = buildColumnProfiles(table)
    const result = runAnalysis({ table, profiles, settings: defaultSettings() })

    expect(result.summary.recordCount).toBe(4)
    expect(result.summary.columnCount).toBe(2)
    expect(result.summary.findingCount).toBeGreaterThan(0)
    expect(result.findings[0].severity).toBe(result.findings[0].severity)

    const severities = result.findings.map((f) => f.severity)
    const order = { error: 0, warning: 1, info: 2 } as const
    const sorted = [...severities].sort((a, b) => order[a] - order[b])
    expect(severities).toEqual(sorted)
  })

  it('records the checks performed and the limitations', () => {
    const table = tableOf('a\n1\n')
    const result = runAnalysis({ table, profiles: buildColumnProfiles(table), settings: defaultSettings() })
    expect(result.checksPerformed.length).toBeGreaterThan(5)
    expect(result.limitations.join(' ')).toMatch(/cannot confirm/i)
  })

  it('never reports a finding with an empty explanation', () => {
    const table = tableOf('a,b\n1,x\n1,x\n,\n')
    const result = runAnalysis({ table, profiles: buildColumnProfiles(table), settings: defaultSettings() })
    for (const finding of result.findings) {
      expect(finding.title.length).toBeGreaterThan(0)
      expect(finding.explanation.length).toBeGreaterThan(0)
      expect(finding.method.length).toBeGreaterThan(0)
      expect(finding.nextStep.length).toBeGreaterThan(0)
    }
  })
})
