import { useState } from 'react'
import { Callout, EmptyState, Stat } from '../components/ui'
import { downloadText, reportFileName } from '../lib/download'
import { buildHtmlReport } from '../lib/report/html'
import { buildJsonReport, serializeJsonReport } from '../lib/report/json'
import { useSession } from '../state/session'

export function Reports({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { analysis, dataset, exportOptions, setExportOptions, clearSession, comparison } = useSession()
  const [exported, setExported] = useState<string | null>(null)

  if (!analysis || !dataset) {
    return (
      <div>
        <div className="page-intro">
          <h1>Reports</h1>
          <p className="lede">Export the results of an analysis as a JSON or HTML report.</p>
        </div>
        <EmptyState title="There is nothing to export yet">
          <p>Analyse a dataset first, then return here to export the findings.</p>
          <button type="button" className="primary" onClick={() => onNavigate('analyze')}>
            Analyze a dataset
          </button>
        </EmptyState>
      </div>
    )
  }

  const jsonReport = buildJsonReport(analysis, dataset.table, dataset.profiles, exportOptions)
  const jsonText = serializeJsonReport(jsonReport)
  const htmlText = buildHtmlReport(analysis, dataset.table, dataset.profiles, exportOptions)

  const downloadJson = () => {
    downloadText(reportFileName('dataproof-report', analysis.datasetName, 'json'), jsonText, 'application/json')
    setExported(`JSON report downloaded (${(new Blob([jsonText]).size / 1024).toFixed(1)} KB).`)
  }

  const downloadHtml = () => {
    downloadText(reportFileName('dataproof-report', analysis.datasetName, 'html'), htmlText, 'text/html')
    setExported(`HTML report downloaded (${(new Blob([htmlText]).size / 1024).toFixed(1)} KB). Open it in any browser, or print it to PDF.`)
  }

  const openHtmlPreview = () => {
    const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  return (
    <div>
      <div className="page-intro">
        <h1>Reports</h1>
        <p className="lede">
          Export the findings for the dataset <strong>{analysis.datasetName}</strong>. Reports are generated in this
          browser tab; nothing is sent anywhere.
        </p>
      </div>

      <Callout tone="warning" title="A report is not proof">
        <p style={{ marginBottom: 0 }}>
          The exported report records what was checked and what was found. It does not establish that any figure is
          correct, and a clean report does not mean the dataset is accurate. Every report states this explicitly, along
          with the methods used and the known limitations.
        </p>
      </Callout>

      {exported ? (
        <Callout tone="info" title="Export complete">
          <p style={{ marginBottom: 0 }}>{exported}</p>
        </Callout>
      ) : null}

      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <Stat value={analysis.summary.recordCount.toLocaleString()} label="Records in report" />
        <Stat value={analysis.summary.findingCount} label="Findings included" />
        <Stat value={analysis.summary.affectedRowCount} label="Affected rows referenced" />
        <Stat value={dataset.table.parseIssues.length} label="Import issues listed" />
      </div>

      <div className="card">
        <h3>Record values in the report</h3>
        <p className="small muted">
          By default the report reproduces no records from your dataset — only row numbers and aggregate results.
          Individual findings do quote a small number of example values (up to 20) to explain what was detected,
          because a finding without an example is not actionable. This remains the safer default for sensitive material
          such as leaked documents, individual-level records or unpublished contract data.
        </p>
        <label className="checkline">
          <input
            type="checkbox"
            checked={exportOptions.includeValues}
            onChange={(event) => setExportOptions({ ...exportOptions, includeValues: event.target.checked })}
          />
          <span>
            Include the values of affected records in the report
            <span className="tiny faint" style={{ display: 'block' }}>
              Up to {exportOptions.maxRecordsPerFinding} records per finding. The file then contains real data and must be
              handled accordingly.
            </span>
          </span>
        </label>

        {exportOptions.includeValues ? (
          <Callout tone="error" title="Privacy warning">
            <p style={{ marginBottom: 0 }}>
              The report will contain actual values from the analysed dataset. Treat the exported file with the same care
              as the original. Do not send it over an insecure channel, and check it before sharing it with anyone.
            </p>
          </Callout>
        ) : null}

        {exportOptions.includeValues ? (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="max-records">Maximum records included per finding</label>
            <input
              id="max-records"
              type="number"
              min={1}
              max={1000}
              value={exportOptions.maxRecordsPerFinding}
              onChange={(event) =>
                setExportOptions({
                  ...exportOptions,
                  maxRecordsPerFinding: Math.max(1, Math.min(1000, Number(event.target.value) || 100)),
                })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>JSON report</h3>
          <p className="small muted">
            Machine-readable. Contains tool and version, generation time, dataset metadata, column profiles, import
            issues, the settings used, every finding with its method and uncertainty, numerical statistics, and the list
            of checks performed.
          </p>
          <p className="tiny faint">Approximate size: {(new Blob([jsonText]).size / 1024).toFixed(1)} KB</p>
          <div className="row">
            <button type="button" className="primary" onClick={downloadJson}>
              Download JSON
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(jsonText).then(
                  () => setExported('JSON report copied to the clipboard.'),
                  () => setExported('The clipboard could not be written to; use the download button instead.'),
                )
              }}
            >
              Copy to clipboard
            </button>
          </div>
        </div>

        <div className="card">
          <h3>HTML report</h3>
          <p className="small muted">
            Readable and self-contained. Groups findings by category, explains each one in plain language, lists affected
            row references, and includes the methodology and limitations. Opens in any browser and prints to PDF.
          </p>
          <p className="tiny faint">Approximate size: {(new Blob([htmlText]).size / 1024).toFixed(1)} KB</p>
          <div className="row">
            <button type="button" className="primary" onClick={downloadHtml}>
              Download HTML
            </button>
            <button type="button" onClick={openHtmlPreview}>
              Open preview in a new tab
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>What every report includes</h3>
        <ul className="small">
          <li>The analysis date and time (UTC), in the report header and the JSON.</li>
          <li>The original file name, its size, the detected delimiter and the number of records and columns.</li>
          <li>Whether the first record was used as a header row, and every assumption made while reading the file.</li>
          <li>The checks that were performed and the exact statistical method used for outlier detection.</li>
          <li>The user-defined validation rules and cross-field comparisons, written out in words.</li>
          <li>Every finding: title, explanation, columns, affected row numbers, method, suggested next step and, where
            relevant, what the finding does not establish.</li>
          <li>The known limitations of the checks, and the statement that the report is not proof of accuracy.</li>
          <li>When enabled, the values of affected records, together with a privacy notice.</li>
          <li>
            By default, no records are reproduced. Findings still quote a handful of example values so that each one
            can be understood and checked.
          </li>
        </ul>
      </div>

      <div className="card">
        <h3>Working session</h3>
        <p className="small muted">
          The imported dataset, the settings and the findings exist only in this browser tab. They are held in memory and
          are not written to disk, to cookies or to local storage. Closing or reloading the tab clears them.
        </p>
        <div className="row">
          <button
            type="button"
            className="danger"
            onClick={() => {
              clearSession()
              onNavigate('dashboard')
            }}
          >
            Clear the current session
          </button>
          <span className="small muted">
            Removes the dataset, the settings, the findings and {comparison ? 'the comparison' : 'any comparison'} from memory.
          </span>
        </div>
      </div>
    </div>
  )
}
