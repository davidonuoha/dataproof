import { DropZone } from './DropZone'
import { SAMPLE_DATASETS, SAMPLE_EXPENDITURE_REVISED } from '../lib/sampleData'
import { useSession } from '../state/session'
import { Callout } from './ui'

/** The import screen shown when no dataset is loaded. */
export function ImportPanel() {
  const { importFile, importText, status } = useSession()
  const busy = status === 'parsing' || status === 'analyzing'

  return (
    <div>
      <div className="page-intro">
        <h1>Analyze a dataset</h1>
        <p className="lede">
          Import a CSV file to inspect its structure and run the quality checks. The file is read by your browser and
          never leaves this device.
        </p>
      </div>

      <div className="card">
        <DropZone
          inputId="dataset-file"
          title="Import a CSV file"
          description="The first record is read as the column names unless you turn that off after import."
          onFile={(file) => void importFile(file)}
          disabled={busy}
        />
        <p className="tiny faint" style={{ marginTop: 12, marginBottom: 0 }}>
          Supported: comma, semicolon, tab and pipe delimited text files saved as UTF-8. Excel workbooks (.xlsx), PDFs
          and scanned documents are <strong>not</strong> supported. In Excel, use “Save as → CSV UTF-8” first.
        </p>
      </div>

      <h2>Or open a sample dataset</h2>
      <div className="grid-cards">
        {[...SAMPLE_DATASETS, SAMPLE_EXPENDITURE_REVISED].map((sample) => (
          <div className="card" key={sample.id}>
            <h3>{sample.name}</h3>
            <p className="small muted">{sample.summary}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void importText(sample.csv, `${sample.id}.csv`, new Blob([sample.csv]).size, {})}
            >
              Load sample
            </button>
          </div>
        ))}
      </div>

      <Callout tone="info" title="Privacy">
        <p style={{ marginBottom: 0 }}>
          DataProof has no backend. Parsing, the checks and report generation all happen in this browser tab. Nothing is
          logged to the console, no analytics collect dataset contents, and no file is written to storage unless you
          choose to download a report.
        </p>
      </Callout>
    </div>
  )
}
