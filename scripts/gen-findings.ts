import { runAnalysis } from '../src/lib/analyze'
import { parseCsvText } from '../src/lib/csv'
import { buildColumnProfiles } from '../src/lib/profile'
import { defaultSettings, type AnalysisSettings } from '../src/lib/types'
import {
  SAMPLE_GOVERNMENT_EXPENDITURE,
  SAMPLE_ELECTION_RESULTS,
  SAMPLE_PUBLIC_HEALTH,
  SAMPLE_EXPENDITURE_REVISED,
  type SampleDataset,
} from '../src/lib/sampleData'
import { compareDatasets } from '../src/lib/compare'

function analyse(sample: SampleDataset, settings: AnalysisSettings = defaultSettings()) {
  const table = parseCsvText(sample.csv, `${sample.id}.csv`, sample.csv.length, {})
  const profiles = buildColumnProfiles(table)
  return { table, profiles, analysis: runAnalysis({ table, profiles, settings }) }
}

const out: string[] = []
out.push(`# Documented sample findings

Every dataset under \`samples/\` is **fictional**. The tables below were produced by
running the shipped checks over the shipped files, so they are a record of what the
application actually reports rather than a description of what it is meant to report.

Reproduce them with:

\`\`\`bash
npm test -- src/test/samples.test.ts
\`\`\`

The severity shown is the severity DataProof assigns. Note how few findings are
\`Error\`: an error is reserved for a rule that was explicitly defined and then
violated. Everything else is a warning or an observation.

`)

const samples: Array<[SampleDataset, AnalysisSettings]> = [
  [SAMPLE_GOVERNMENT_EXPENDITURE, defaultSettings()],
  [
    SAMPLE_PUBLIC_HEALTH,
    {
      ...defaultSettings(),
      dateFormats: { 'Reporting Period': 'YYYY-MM-DD' },
      dateFormatSource: { 'Reporting Period': 'user' },
    },
  ],
  [SAMPLE_ELECTION_RESULTS, { ...defaultSettings(), duplicateKeyColumns: ['Polling Unit ID'] }],
]

for (const [sample, settings] of samples) {
  const { table, analysis } = analyse(sample, settings)
  out.push(`## ${sample.name}\n`)
  out.push(`\`samples/${sample.id}.csv\` — ${table.rows.length} records, ${table.headers.length} columns.\n`)
  out.push(`${sample.description}\n`)
  out.push('### Issues deliberately built into the file\n')
  for (const issue of sample.documentedIssues) out.push(`- ${issue}`)
  out.push('')
  out.push('### What DataProof reports\n')
  out.push('| Severity | Category | Finding | Rows |')
  out.push('| --- | --- | --- | --- |')
  for (const f of analysis.findings) {
    const rows = f.rows.length === 0 ? '—' : f.rows.slice(0, 8).join(', ') + (f.rows.length > 8 ? ' …' : '')
    out.push(`| ${f.severity} | ${f.category} | ${f.title.replace(/\|/g, '\\|')} | ${rows} |`)
  }
  out.push('')
  out.push(
    `Totals: ${analysis.summary.findingCount} findings — ${analysis.summary.bySeverity.error} error(s), ` +
      `${analysis.summary.bySeverity.warning} warning(s), ${analysis.summary.bySeverity.info} observation(s); ` +
      `${analysis.summary.affectedRowCount} of ${analysis.summary.recordCount} rows are referenced by at least one finding.\n`,
  )
}

const older = parseCsvText(SAMPLE_GOVERNMENT_EXPENDITURE.csv, 'government-expenditure-2023.csv', 0, {})
const newer = parseCsvText(SAMPLE_EXPENDITURE_REVISED.csv, 'government-expenditure-revised.csv', 0, {})
const cmp = compareDatasets(older, newer, ['Department', 'Financial Year'])
out.push(`## Comparison: ${SAMPLE_EXPENDITURE_REVISED.name}\n`)
out.push(`Load \`samples/government-expenditure-2023.csv\` as the older file and
\`samples/government-expenditure-revised.csv\` as the newer file, then match on
**Department** + **Financial Year**.\n`)
out.push('### Issues deliberately built into the file\n')
for (const issue of SAMPLE_EXPENDITURE_REVISED.documentedIssues) out.push(`- ${issue}`)
out.push('')
out.push('### What DataProof reports\n')
out.push('| Change | Identifier | Older row | Newer row |')
out.push('| --- | --- | --- | --- |')
for (const r of cmp.records.filter((r) => r.kind !== 'unchanged')) {
  out.push(`| ${r.kind} | ${r.key.replace(/\|/g, '\\|')} | ${r.oldRow ?? '—'} | ${r.newRow ?? '—'} |`)
}
out.push('')
out.push(
  `Counts: ${cmp.counts.added} added, ${cmp.counts.removed} removed, ${cmp.counts.changed} changed, ` +
    `${cmp.counts.unchanged} unchanged. Column changes: ` +
    cmp.columnChanges.map((c) => `\`${c.name}\` (${c.change})`).join(', ') +
    '.\n',
)
out.push('### Limitations this comparison demonstrates\n')
for (const l of cmp.limitations) out.push(`- ${l}`)
out.push('')

console.log(out.join('\n'))
