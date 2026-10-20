import { Callout } from '../components/ui'
import { MAX_FILE_BYTES, LARGE_FILE_BYTES, PREVIEW_ROW_LIMIT, formatBytes } from '../lib/csv'
import { MAX_ROWS_PER_FINDING } from '../lib/checks/helpers'
import { MAX_COMPARISON_RECORDS } from '../lib/compare'

const TOOLS = [
  {
    name: 'OpenRefine',
    role: 'Interactive cleaning and transformation of messy tabular data, with faceting and clustering of similar text values.',
    difference:
      'OpenRefine is built for transforming data and expects the user to operate on it. DataProof does not modify data at all: it produces findings that point back at the original records and never merges, fixes or deletes anything.',
  },
  {
    name: 'csvlint (Open Data Institute)',
    role: 'Validates CSV files against CSV-on-the-Web rules and an optional schema, reporting structural and schema errors.',
    difference:
      'csvlint is a schema validator with a formal error model. DataProof adds journalism-facing checks that a schema cannot express — outliers, category spelling variants, ambiguous dates, cross-field totals and version-to-version changes — and explains each finding in plain language with a suggested next step.',
  },
  {
    name: 'Frictionless Framework / goodtables',
    role: 'Validates tabular data against Table Schema and produces machine-readable validation reports.',
    difference:
      'Frictionless targets data publishers and pipelines, and expects a schema to be written first. DataProof is designed for a reporter who has just received a file and does not yet know what a valid row looks like.',
  },
  {
    name: 'csvkit (csvstat, csvclean, csvdedupe)',
    role: 'Command-line utilities for inspecting, summarising, cleaning and de-duplicating CSV files.',
    difference:
      'csvkit is scriptable and powerful, but it requires a terminal and its output is not a findings report. DataProof requires no installation, runs in the browser, and turns statistics into explanations.',
  },
  {
    name: 'Table-diffing tools (daff, csvdiff, datadiff)',
    role: 'Show cell-level differences between two versions of a table.',
    difference:
      'These tools answer "what changed". DataProof answers "what changed, what does it mean for this analysis, and what are the limits of that comparison" — including an explicit warning when records have to be matched by position rather than by an identifier.',
  },
  {
    name: 'Profiling and data-quality frameworks (ydata-profiling, Great Expectations, Soda)',
    role: 'Automated profiling and expectation-based data quality testing, mainly in data engineering pipelines.',
    difference:
      'They are built for repeated automated runs over data the team owns. DataProof is built for a single, unfamiliar file, and it is deliberately unwilling to call a value wrong just because it is unusual.',
  },
]

export function About() {
  return (
    <div>
      <div className="page-intro">
        <h1>About DataProof</h1>
        <p className="lede">
          DataProof is an open-source tool that helps journalists find the problems in a dataset before they publish a
          story based on it.
        </p>
      </div>

      <Callout tone="warning" title="Validation is not verification">
        <p>
          This distinction matters more than any feature in the application.
        </p>
        <p>
          <strong>Data validation</strong> asks whether a file is internally consistent: are there empty cells, is the
          same category spelled two ways, do the totals add up, did a figure change between releases. DataProof does
          that.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Factual verification</strong> asks whether a number is true. That requires the original document, the
          agency that produced it, or a second independent source. No tool can do it from the file alone. DataProof
          cannot tell you that a figure is correct, and it will not pretend otherwise.
        </p>
      </Callout>

      <div className="card">
        <h2>What it checks</h2>
        <ul>
          <li>
            <strong>Missing values</strong> — empty cells per column and per row. Zero, false and text are treated as
            recorded values, never as missing data.
          </li>
          <li>
            <strong>Duplicates</strong> — identical rows, and rows that match on columns you select. Reported, never
            removed.
          </li>
          <li>
            <strong>Inconsistent categories</strong> — the same category written in several ways. Suggested, never merged.
          </li>
          <li>
            <strong>Dates</strong> — validated against one format you choose. Ambiguous values are flagged, not resolved.
          </li>
          <li>
            <strong>Numbers</strong> — descriptive statistics, invalid entries, negatives, zeros and outliers found with a
            documented method.
          </li>
          <li>
            <strong>Rules you define</strong> — required fields, ranges, uniqueness, permitted lists and non-negative
            values.
          </li>
          <li>
            <strong>Cross-field totals</strong> — a total compared with the sum of its components, with an explicit
            formula and tolerance.
          </li>
          <li>
            <strong>Version comparison</strong> — added, removed and changed records between two releases of a file.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>What it deliberately does not do</h2>
        <ul>
          <li>No AI, no chatbot, no automatic writing. Nothing here generates prose about your data.</li>
          <li>No accounts, no sign-in, no cloud storage.</li>
          <li>No reading of Excel workbooks, PDFs, images or scanned documents. CSV and plain text only.</li>
          <li>No automatic repair of data. DataProof does not rewrite values, merge categories or delete rows.</li>
          <li>No claim to be a fact-checker. It checks internal consistency and stops there.</li>
          <li>No analytics, no telemetry, no dataset contents in the browser console.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Privacy and how your data is handled</h2>
        <ul>
          <li>Files are read by your browser and processed in the tab. No file is uploaded to a server.</li>
          <li>
            There is no backend. The application is a static bundle of HTML, JavaScript and CSS, so there is nothing that
            could receive your data even if it were configured to.
          </li>
          <li>
            Datasets are held in memory only. They are not written to disk, cookies, local storage or IndexedDB. Closing
            or reloading the tab clears everything, and the “Clear session” button clears it immediately.
          </li>
          <li>
            Reports are generated locally and downloaded through your browser. Exported HTML escapes every dataset value,
            so a cell containing markup is displayed as text and never executed.
          </li>
          <li>No spreadsheet formula or user-supplied code is ever evaluated.</li>
          <li>
            Reports reproduce no records by default. Individual findings quote a small number of example values (up to
            20) so that each one can be understood and checked; the records behind them are not reproduced.
          </li>
          <li>
            If you enable “include record values”, the exported report will contain real data from your file, including
            the values of every column for each affected record. That is your choice, and the report says so on its face.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Practical limits of this release</h2>
        <ul>
          <li>
            Files above <strong>{formatBytes(MAX_FILE_BYTES)}</strong> are refused with an explanation. Between{' '}
            {formatBytes(LARGE_FILE_BYTES)} and the limit, expect a noticeable pause while the file is parsed.
          </li>
          <li>Parsing runs in a background worker so the interface stays responsive, but the checks themselves run on the main thread.</li>
          <li>The data preview shows the first {PREVIEW_ROW_LIMIT} records. All records are checked, not just the preview.</li>
          <li>
            A single finding lists up to {MAX_ROWS_PER_FINDING} affected row numbers in the interface and in the export;
            the total count is always reported in full.
          </li>
          <li>
            The comparison screen keeps up to {MAX_COMPARISON_RECORDS.toLocaleString()} record-level differences in the
            result; the counts describe the whole comparison.
          </li>
          <li>Only UTF-8 (with or without a byte-order mark) is supported. Legacy encodings such as Windows-1252 may produce mangled text.</li>
          <li>Header detection and type detection are heuristics. Both can be overridden by hand.</li>
        </ul>
      </div>

      <div className="card">
        <h2>How it relates to existing tools</h2>
        <p className="muted">
          DataProof is not the first tool to validate a CSV file, and it does not claim to be the most advanced. Several
          mature projects solve overlapping problems well. What follows is an honest description of where they sit
          relative to this one.
        </p>
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table className="data" style={{ whiteSpace: 'normal', fontSize: '0.86rem' }}>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">What it does</th>
                <th scope="col">How DataProof differs</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => (
                <tr key={tool.name}>
                  <th scope="row" style={{ textAlign: 'left', whiteSpace: 'normal' }}>{tool.name}</th>
                  <td style={{ whiteSpace: 'normal' }}>{tool.role}</td>
                  <td style={{ whiteSpace: 'normal' }}>{tool.difference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          DataProof reuses established libraries rather than reimplementing them: PapaParse for CSV parsing and React for
          the interface. Its contribution is not a new parser or a new statistic. It is a journalism-oriented workflow —
          inspect first, explain every finding, state the uncertainty, and never call an unusual value wrong — plus a
          report that an editor can read and a machine can process.
        </p>
      </div>

      <div className="card">
        <h2>Licence, source and contributions</h2>
        <p>
          DataProof is released under the MIT licence. The source code, the sample datasets, the tests and the
          documentation are in the same repository.
        </p>
        <p className="muted small">
          The sample datasets shipped with the application are entirely fictional. They contain deliberately introduced
          problems so that the checks can be demonstrated and tested, and they must not be used to make any claim about
          real departments, candidates, elections or health statistics.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Bug reports, additional checks and better explanations of findings are all welcome. See{' '}
          <code>CONTRIBUTING.md</code> in the repository.
        </p>
      </div>
    </div>
  )
}
