import { describe, expect, it } from 'vitest'
import { runAnalysis } from '../lib/analyze'
import { compareDatasets } from '../lib/compare'
import { escapeCsv, escapeHtml } from '../lib/html'
import { parseCsvText } from '../lib/csv'
import { buildColumnProfiles } from '../lib/profile'
import { buildHtmlComparisonReport, buildHtmlReport } from '../lib/report/html'
import {
  DEFAULT_EXPORT_OPTIONS,
  buildJsonComparisonReport,
  buildJsonReport,
  serializeJsonReport,
} from '../lib/report/json'
import { defaultSettings } from '../lib/types'

const CSV = `department,amount,note
Water,100,ok
Health,,<script>alert(1)</script>
Water,100,ok
`

const table = parseCsvText(CSV, 'report-fixture.csv', CSV.length, {})
const profiles = buildColumnProfiles(table)
const analysis = runAnalysis({ table, profiles, settings: defaultSettings() })

describe('HTML escaping', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;')
  })

  it('handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('escapes CSV cells containing separators or quotes', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsv('plain')).toBe('plain')
  })
})

describe('JSON report', () => {
  it('contains the metadata, settings, checks and findings', () => {
    const report = buildJsonReport(analysis, table, profiles, DEFAULT_EXPORT_OPTIONS)
    expect(report.reportType).toBe('dataset-analysis')
    expect(report.dataset.fileName).toBe('report-fixture.csv')
    expect(report.dataset.recordCount).toBe(3)
    expect(report.dataset.columnCount).toBe(3)
    expect(report.checksPerformed.length).toBeGreaterThan(0)
    expect(report.findings.length).toBeGreaterThan(0)
    expect(report.limitations.length).toBeGreaterThan(0)
    expect(report.settings).toBeDefined()
  })

  it('records the analysis date and time', () => {
    const report = buildJsonReport(analysis, table, profiles, DEFAULT_EXPORT_OPTIONS)
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false)
  })

  it('omits record values by default and says so', () => {
    const report = buildJsonReport(analysis, table, profiles, DEFAULT_EXPORT_OPTIONS)
    expect(report.privacy.includedRecordValues).toBe(false)
    for (const finding of report.findings) {
      expect(finding.affectedRecords).toBeUndefined()
    }
    expect(report.privacy.note).toMatch(/reproduces no records/i)
  })

  it('includes record values when the user opts in', () => {
    const report = buildJsonReport(analysis, table, profiles, { includeValues: true, maxRecordsPerFinding: 10 })
    const withRecords = report.findings.find((f) => f.affectedRecords && f.affectedRecords.length > 0)
    expect(withRecords).toBeDefined()
    expect(withRecords?.affectedRecords?.[0].values).toBeDefined()
    expect(report.privacy.includedRecordValues).toBe(true)
  })

  it('is valid JSON when serialised', () => {
    const text = serializeJsonReport(buildJsonReport(analysis, table, profiles, DEFAULT_EXPORT_OPTIONS))
    expect(() => JSON.parse(text)).not.toThrow()
    const parsed = JSON.parse(text)
    expect(parsed.findings[0]).toHaveProperty('affectedRowCount')
    expect(parsed.findings[0]).not.toHaveProperty('rows')
  })

  it('serialises a comparison report', () => {
    const older = parseCsvText('id,v\n1,a\n2,b\n', 'old.csv', 20, {})
    const newer = parseCsvText('id,v\n1,a\n2,c\n', 'new.csv', 20, {})
    const comparison = compareDatasets(older, newer, ['id'])
    const report = buildJsonComparisonReport(comparison, older, newer, DEFAULT_EXPORT_OPTIONS)
    expect(report.reportType).toBe('dataset-comparison')
    expect(report.counts.changed).toBe(1)
    expect(() => JSON.parse(serializeJsonReport(report))).not.toThrow()
  })
})

describe('HTML report', () => {
  const html = buildHtmlReport(analysis, table, profiles, DEFAULT_EXPORT_OPTIONS)

  it('is a complete HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('</html>')
    expect(html).toContain('<title>')
  })

  it('states that the report is not proof of accuracy', () => {
    expect(html).toMatch(/not proof that the data is accurate/i)
  })

  it('includes the file name, dimensions and generation time', () => {
    expect(html).toContain('report-fixture.csv')
    expect(html).toContain('Records')
    expect(html).toMatch(/Generated \d{4}-\d{2}-\d{2}/)
  })

  it('groups findings by category and includes methods and next steps', () => {
    expect(html).toContain('Findings by category')
    expect(html).toContain('Rule or method used')
    expect(html).toContain('Suggested next step')
    expect(html).toContain('Known limitations')
  })

  it('escapes dataset values so markup cannot execute', () => {
    const withValues = buildHtmlReport(analysis, table, profiles, { includeValues: true, maxRecordsPerFinding: 50 })
    expect(withValues).not.toContain('<script>alert(1)</script>')
    expect(withValues).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('does not include record values unless the user opted in', () => {
    const withoutValues = buildHtmlReport(analysis, table, profiles, DEFAULT_EXPORT_OPTIONS)
    expect(withoutValues).not.toContain('Affected record values')
    expect(withoutValues).toMatch(/reproduces no records from the analysed dataset/i)
  })

  it('warns about privacy when record values are included', () => {
    const withValues = buildHtmlReport(analysis, table, profiles, { includeValues: true, maxRecordsPerFinding: 50 })
    expect(withValues).toMatch(/Privacy notice/i)
  })

  it('builds a comparison report with before-and-after values', () => {
    const older = parseCsvText('id,v\n1,a\n2,b\n', 'old.csv', 20, {})
    const newer = parseCsvText('id,v\n1,a\n2,c\n', 'new.csv', 20, {})
    const comparison = compareDatasets(older, newer, ['id'])
    const comparisonHtml = buildHtmlComparisonReport(comparison, older, newer, DEFAULT_EXPORT_OPTIONS)
    expect(comparisonHtml).toContain('Comparison report')
    expect(comparisonHtml).toContain('b → c')
    expect(comparisonHtml).toMatch(/difference is not an error/i)
  })

  it('escapes markup inside a comparison report', () => {
    const older = parseCsvText('id,v\n1,<b>x</b>\n', 'old.csv', 20, {})
    const newer = parseCsvText('id,v\n1,<i>y</i>\n', 'new.csv', 20, {})
    const comparison = compareDatasets(older, newer, ['id'])
    const comparisonHtml = buildHtmlComparisonReport(comparison, older, newer, DEFAULT_EXPORT_OPTIONS)
    expect(comparisonHtml).not.toContain('<b>x</b>')
    expect(comparisonHtml).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
