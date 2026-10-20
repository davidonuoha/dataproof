import { describe, expect, it } from 'vitest'
import { runAnalysis } from '../lib/analyze'
import { parseCsvText } from '../lib/csv'
import { buildColumnProfiles } from '../lib/profile'
import { compareDatasets } from '../lib/compare'
import {
  SAMPLE_DATASETS,
  SAMPLE_ELECTION_RESULTS,
  SAMPLE_EXPENDITURE_REVISED,
  SAMPLE_GOVERNMENT_EXPENDITURE,
  SAMPLE_PUBLIC_HEALTH,
} from '../lib/sampleData'
import { defaultSettings } from '../lib/types'

function analyse(sample: { csv: string; id: string }) {
  const table = parseCsvText(sample.csv, `${sample.id}.csv`, sample.csv.length, {})
  const profiles = buildColumnProfiles(table)
  const analysis = runAnalysis({ table, profiles, settings: defaultSettings() })
  return { table, profiles, analysis }
}

const ids = (analysis: { findings: Array<{ id: string }> }) => analysis.findings.map((f) => f.id)

describe('sample datasets', () => {
  it('ships at least three samples and labels them as fictional', () => {
    expect(SAMPLE_DATASETS.length).toBeGreaterThanOrEqual(3)
    for (const sample of SAMPLE_DATASETS) {
      expect(sample.documentedIssues.length).toBeGreaterThan(0)
      expect(sample.description.toLowerCase()).toContain('fictional')
    }
  })

  it('every documented issue list is specific enough to test against', () => {
    for (const sample of SAMPLE_DATASETS) {
      for (const issue of sample.documentedIssues) {
        expect(issue.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('sample A — government expenditure', () => {
  const { table, analysis } = analyse(SAMPLE_GOVERNMENT_EXPENDITURE)

  it('parses into the expected shape', () => {
    expect(table.headers).toEqual(['Department', 'Financial Year', 'Budget Allocation', 'Actual Expenditure'])
    expect(table.rows).toHaveLength(24)
    expect(table.parseIssues).toHaveLength(0)
  })

  it('finds the empty cells in Actual Expenditure and Budget Allocation', () => {
    expect(ids(analysis)).toContain('missing-Actual Expenditure')
    expect(ids(analysis)).toContain('missing-Budget Allocation')
  })

  it('finds the two duplicated records', () => {
    const exact = analysis.findings.find((f) => f.id === 'duplicates-exact')
    expect(exact).toBeDefined()
    expect(exact?.evidence?.groupCount).toBe(2)
  })

  it('finds the inconsistent department spelling', () => {
    expect(ids(analysis)).toContain('categories-Department')
  })

  it('finds the negative expenditure', () => {
    const negative = analysis.findings.find((f) => f.id === 'numeric-negative-Actual Expenditure')
    expect(negative).toBeDefined()
    expect(negative?.evidence?.minimum).toBe(-25000000)
  })

  it('flags the extreme transport figure as an outlier, not an error', () => {
    const outliers = analysis.findings.find((f) => f.id === 'numeric-outliers-Actual Expenditure')
    expect(outliers).toBeDefined()
    expect(outliers?.severity).toBe('warning')
    expect(outliers?.evidence?.examples).toBeDefined()
  })

  it('detects a budget-versus-actual relationship when the user defines one', () => {
    const profiles = buildColumnProfiles(table)
    const settings = {
      ...defaultSettings(),
      crossFieldRules: [
        {
          id: 'x1',
          label: '',
          components: ['Budget Allocation'],
          total: 'Actual Expenditure',
          tolerance: 0,
          toleranceMode: 'absolute' as const,
          ignoreEmpty: true,
          enabled: true,
        },
      ],
    }
    const result = runAnalysis({ table, profiles, settings })
    const finding = result.findings.find((f) => f.id === 'crossfield-x1')
    expect(finding).toBeDefined()
    // Only rows where actual expenditure exceeds the allocation are mismatches
    // (under-spending is not, because the rule as written demands equality).
    expect(finding!.rows.length).toBeGreaterThan(0)
  })
})

describe('sample B — election results', () => {
  const { table, analysis } = analyse(SAMPLE_ELECTION_RESULTS)

  it('parses into the expected shape', () => {
    expect(table.headers).toEqual(['State', 'Local Government Area', 'Polling Unit ID', 'Candidate', 'Votes Recorded'])
    expect(table.rows).toHaveLength(23)
  })

  it('reports the malformed record with an extra field', () => {
    expect(table.parseIssues.some((i) => i.code === 'TooManyFields')).toBe(true)
  })

  it('finds the empty local government area and vote count', () => {
    expect(ids(analysis)).toContain('missing-Local Government Area')
    expect(ids(analysis)).toContain('missing-Votes Recorded')
  })

  it('finds the duplicated polling units, both as exact and key duplicates', () => {
    expect(ids(analysis)).toContain('duplicates-exact')
    const profiles = buildColumnProfiles(table)
    const settings = { ...defaultSettings(), duplicateKeyColumns: ['Polling Unit ID'] }
    const withKey = runAnalysis({ table, profiles, settings })
    expect(ids(withKey)).toContain('duplicates-key')
  })

  it('finds the inconsistent state spelling', () => {
    expect(ids(analysis)).toContain('categories-State')
  })

  it('treats polling unit codes as text, not numbers', () => {
    const pollingUnit = buildColumnProfiles(table).find((p) => p.name === 'Polling Unit ID')
    expect(pollingUnit?.type).toBe('text')
  })
})

describe('sample C — public health statistics', () => {
  const { table, analysis } = analyse(SAMPLE_PUBLIC_HEALTH)

  it('parses into the expected shape', () => {
    expect(table.headers).toEqual(['Region', 'Reporting Period', 'Indicator', 'Reported Value'])
    expect(table.rows).toHaveLength(30)
  })

  it('finds the missing reported value', () => {
    expect(ids(analysis)).toContain('missing-Reported Value')
  })

  it('finds the inconsistent indicator spellings', () => {
    expect(ids(analysis)).toContain('categories-Indicator')
  })

  it('reports "not reported" as a value that cannot be read as a number', () => {
    const invalid = analysis.findings.find((f) => f.id === 'numeric-invalid-Reported Value')
    expect(invalid).toBeDefined()
    const examples = invalid?.evidence?.examples as string[]
    expect(examples).toContain('not reported')
  })

  it('finds the negative outpatient count and the placeholder outlier', () => {
    expect(ids(analysis)).toContain('numeric-negative-Reported Value')
    const outliers = analysis.findings.find((f) => f.id === 'numeric-outliers-Reported Value')
    expect(outliers).toBeDefined()
  })

  it('validates the reporting period as a date once a format is chosen', () => {
    const profiles = buildColumnProfiles(table)
    const settings = {
      ...defaultSettings(),
      dateFormats: { 'Reporting Period': 'YYYY-MM-DD' as const },
      dateFormatSource: { 'Reporting Period': 'user' as const },
    }
    const result = runAnalysis({ table, profiles, settings })
    const dateFinding = result.findings.find((f) => f.id === 'dates-invalid-Reporting Period')
    expect(dateFinding).toBeUndefined()
  })

  it('does not report a percentage above 100 as an error', () => {
    const above100 = analysis.findings.filter(
      (f) => f.category === 'numeric' && f.columns.includes('Reported Value') && f.severity === 'error',
    )
    expect(above100).toHaveLength(0)
  })
})

describe('sample D — revised expenditure release', () => {
  it('compares against sample A with the documented differences', () => {
    const older = parseCsvText(SAMPLE_GOVERNMENT_EXPENDITURE.csv, 'expenditure-2023.csv', 0, {})
    const newer = parseCsvText(SAMPLE_EXPENDITURE_REVISED.csv, 'expenditure-2024.csv', 0, {})
    const result = compareDatasets(older, newer, ['Department', 'Financial Year'])

    expect(result.counts.added).toBeGreaterThanOrEqual(1)
    expect(result.counts.removed).toBeGreaterThanOrEqual(1)
    expect(result.counts.changed).toBeGreaterThanOrEqual(2)

    const addedKeys = result.records.filter((r) => r.kind === 'added').map((r) => r.key)
    expect(addedKeys.join(' ')).toMatch(/Digital Economy/)

    const removedKeys = result.records.filter((r) => r.kind === 'removed').map((r) => r.key)
    expect(removedKeys.join(' ')).toMatch(/Health/)

    expect(result.columnChanges).toContainEqual({ name: 'Expenditure Actual', change: 'added' })
    expect(result.columnChanges).toContainEqual({ name: 'Actual Expenditure', change: 'removed' })

    // Documented limitation: a renamed column is not matched, so changes inside
    // it are deliberately not reported as value changes.
    const changedColumns = new Set(result.records.flatMap((r) => r.changes.map((c) => c.column)))
    expect(changedColumns.has('Expenditure Actual')).toBe(false)
    expect(changedColumns.has('Actual Expenditure')).toBe(false)
    expect(changedColumns.has('Budget Allocation')).toBe(true)
  })
})
