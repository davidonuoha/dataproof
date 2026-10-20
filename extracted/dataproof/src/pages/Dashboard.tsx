import { SAMPLE_DATASETS } from '../lib/sampleData'
import { useSession } from '../state/session'
import { Callout, Stat } from '../components/ui'

const CHECKS = [
  {
    title: 'Missing values',
    body: 'Empty cells per column and per row. Zero, false and text are treated as recorded values, never as missing data.',
  },
  {
    title: 'Duplicate records',
    body: 'Identical rows, and rows that match on columns you choose. Duplicates are reported, never deleted or merged.',
  },
  {
    title: 'Inconsistent categories',
    body: 'The same category written in several ways — Lagos, lagos, LAGOS — reported as a suggestion, with the original values preserved.',
  },
  {
    title: 'Date validation',
    body: 'Every value checked against one date format you select. Ambiguous values such as 03/04/2024 are flagged, never silently resolved.',
  },
  {
    title: 'Numerical checks',
    body: 'Minimum, maximum, mean, median and standard deviation, plus invalid entries and outliers found with a documented method.',
  },
  {
    title: 'Validation rules you define',
    body: 'Required fields, ranges, uniqueness, permitted lists and non-negative numbers, run against the whole dataset.',
  },
  {
    title: 'Cross-field consistency',
    body: 'Check that a total equals the sum of its components, with an explicit formula and a tolerance you set.',
  },
  {
    title: 'Dataset comparison',
    body: 'Two versions of a file compared record by record: added, removed and changed, with before-and-after values.',
  },
]

export function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { importText, status } = useSession()
  const busy = status === 'parsing' || status === 'analyzing'

  return (
    <div>
      <div className="page-intro">
        <h1>Check a dataset before you publish it</h1>
        <p className="lede">
          DataProof examines a CSV file for the problems that cause corrections: empty cells, repeated records, the same
          category spelled several ways, dates that do not parse, totals that do not add up and figures that changed
          between releases.
        </p>
        <p>
          Everything runs in your browser. Your file is never uploaded, never stored and never sent to a third party.
          There is no account, no API key and no server.
        </p>
        <p>
          <button type="button" className="primary" onClick={() => onNavigate('analyze')} disabled={busy}>
            Analyze a dataset
          </button>{' '}
          <button type="button" onClick={() => onNavigate('about')}>
            How it works and what it cannot do
          </button>
        </p>
      </div>

      <Callout tone="warning" title="What DataProof does and does not do">
        <p style={{ marginBottom: 0 }}>
          DataProof checks whether a dataset is <strong>internally consistent</strong>. It cannot confirm that a figure
          matches the real world — that requires the original source document. A clean report is not proof that a
          dataset is accurate, and a flagged value is not proof that it is wrong.
        </p>
      </Callout>

      <h2>What it checks</h2>
      <div className="grid-cards">
        {CHECKS.map((check) => (
          <div className="card" key={check.title}>
            <h3>{check.title}</h3>
            <p className="small muted" style={{ marginBottom: 0 }}>
              {check.body}
            </p>
          </div>
        ))}
      </div>

      <h2>Start with a sample dataset</h2>
      <p className="muted" style={{ maxWidth: '70ch' }}>
        These datasets are entirely fictional. Each one has known problems built into it, so you can see how the checks
        behave before you load your own file. Every introduced issue is listed on the Analyze screen and in{' '}
        <code>docs/SAMPLE-FINDINGS.md</code>.
      </p>
      <div className="grid-cards">
        {SAMPLE_DATASETS.map((sample) => (
          <div className="card" key={sample.id}>
            <h3>{sample.name}</h3>
            <p className="small muted">{sample.summary}</p>
            <p className="tiny faint">
              {sample.documentedIssues.length} documented issue{sample.documentedIssues.length === 1 ? '' : 's'} built in
            </p>
            <button
              type="button"
              onClick={() => {
                void importText(sample.csv, `${sample.id}.csv`, new Blob([sample.csv]).size, {})
                onNavigate('analyze')
              }}
              disabled={busy}
            >
              Load this dataset
            </button>
          </div>
        ))}
      </div>

      <h2>How the workflow fits together</h2>
      <div className="grid-stats">
        <Stat value="1" label="Import a CSV" />
        <Stat value="2" label="Confirm column types" />
        <Stat value="3" label="Run checks and rules" />
        <Stat value="4" label="Inspect the records" />
        <Stat value="5" label="Export a report" />
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        The reports you export record the file name, its dimensions, the checks that ran, the methods used and the
        known limitations — so a colleague or an editor can see exactly what was examined and what was not.
      </p>
    </div>
  )
}
