import { useEffect, useState } from 'react'
import { ChecksPanel } from '../components/ChecksPanel'
import { ColumnSettings } from '../components/ColumnSettings'
import { DataTable } from '../components/DataTable'
import { FindingsPanel } from '../components/FindingsPanel'
import { ImportPanel } from '../components/ImportPanel'
import { Callout, Stat, Tabs } from '../components/ui'
import { PREVIEW_ROW_LIMIT, formatBytes } from '../lib/csv'
import { useSession } from '../state/session'

const TAB_IDS = ['data', 'columns', 'checks', 'findings'] as const
type TabId = (typeof TAB_IDS)[number]

export function Analyze() {
  const { dataset, analysis, status, progressLabel, error, dismissError, reparseWithHeader, clearSession, settingsDirty } =
    useSession()
  const [tab, setTab] = useState<TabId>('data')

  useEffect(() => {
    if (dataset) setTab('data')
  }, [dataset?.table])

  if (status === 'parsing' || status === 'analyzing') {
    return (
      <div className="card" role="status" aria-live="polite">
        <h2 style={{ marginBottom: 8 }}>Working…</h2>
        <p className="muted" style={{ marginBottom: 8 }}>{progressLabel || 'Processing the file in your browser.'}</p>
        <div className="progress">
          <span style={{ width: '100%', opacity: 0.5 }} />
        </div>
        <p className="tiny faint" style={{ marginTop: 10, marginBottom: 0 }}>
          Large files take longer. The interface stays responsive because parsing runs in a background worker.
        </p>
      </div>
    )
  }

  if (!dataset) {
    return (
      <>
        {error ? (
          <Callout tone="error" title="Could not import the file">
            <p>{error}</p>
            <button type="button" onClick={dismissError}>
              Dismiss
            </button>
          </Callout>
        ) : null}
        <ImportPanel />
      </>
    )
  }

  const { table, profiles } = dataset
  const previewRows = table.rows.slice(0, PREVIEW_ROW_LIMIT)
  const findingCount = analysis?.findings.length ?? 0

  return (
    <div>
      {error ? (
        <Callout tone="error" title="Problem">
          <p>{error}</p>
          <button type="button" onClick={dismissError}>
            Dismiss
          </button>
        </Callout>
      ) : null}

      <div className="row between" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>{table.fileName}</h1>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {table.rows.length.toLocaleString()} records · {table.headers.length} columns ·{' '}
            {formatBytes(table.fileSizeBytes)} · {delimiterName(table.delimiter)} delimited ·{' '}
            {table.hasHeader ? 'first row used as header' : 'no header row'}
          </p>
        </div>
        <div className="row tight">
          <button type="button" onClick={() => setTab('checks')}>
            Checks and rules
          </button>
          <button type="button" className="danger" onClick={clearSession}>
            Clear session
          </button>
        </div>
      </div>

      <Tabs
        label="Dataset sections"
        active={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: 'data', label: 'Data' },
          { id: 'columns', label: 'Columns' },
          { id: 'checks', label: 'Checks & rules' },
          { id: 'findings', label: 'Findings', badge: findingCount },
        ]}
      />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'data' ? (
          <div>
            <div className="grid-stats" style={{ marginBottom: 18 }}>
              <Stat value={table.rows.length.toLocaleString()} label="Records" />
              <Stat value={table.headers.length} label="Columns" />
              <Stat value={table.rows.length * table.headers.length} label="Cells" />
              <Stat value={profiles.reduce((sum, p) => sum + p.emptyCount, 0)} label="Empty cells" tone="warning" />
              <Stat
                value={table.parseIssues.filter((i) => i.code === 'TooFewFields' || i.code === 'TooManyFields').length}
                label="Malformed rows"
                tone="error"
              />
            </div>

            {table.parseIssues.length > 0 ? (
              <Callout tone="warning" title={`${table.parseIssues.length} issue${table.parseIssues.length === 1 ? '' : 's'} detected while reading the file`}>
                <ul style={{ marginBottom: 0 }}>
                  {table.parseIssues.slice(0, 12).map((issue, index) => (
                    <li key={`${issue.code}-${issue.row}-${index}`} className="small">
                      {issue.row ? <strong>Row {issue.row}: </strong> : null}
                      {issue.message}
                    </li>
                  ))}
                </ul>
                {table.parseIssues.length > 12 ? (
                  <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    …and {table.parseIssues.length - 12} more, listed in full in the exported report.
                  </p>
                ) : null}
              </Callout>
            ) : null}

            {table.notes.length > 0 ? (
              <Callout tone="plain" title="Notes from the import">
                <ul style={{ marginBottom: 0 }}>
                  {table.notes.map((note) => (
                    <li key={note} className="small">
                      {note}
                    </li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            <div className="card">
              <h3>Header row</h3>
              <p className="small muted">
                {table.hasHeader
                  ? 'The first record was treated as column names and is not counted as a data row.'
                  : 'The file was read without a header row, so columns were named by position.'}{' '}
                If that is wrong, switch it here — the file is re-read with the other interpretation.
              </p>
              <div className="row">
                <button type="button" onClick={() => void reparseWithHeader(true)} disabled={table.hasHeader}>
                  First row is a header
                </button>
                <button type="button" onClick={() => void reparseWithHeader(false)} disabled={!table.hasHeader}>
                  First row is data
                </button>
              </div>
            </div>

            <h2>Preview</h2>
            <p className="small muted">
              The first {Math.min(PREVIEW_ROW_LIMIT, table.rows.length)} of {table.rows.length.toLocaleString()} records,
              exactly as they appear in the file. Empty cells are marked.
            </p>
            <DataTable headers={table.headers} rows={previewRows} pageSize={25} caption="Dataset preview" />
          </div>
        ) : null}

        {tab === 'columns' ? <ColumnSettings /> : null}
        {tab === 'checks' ? <ChecksPanel /> : null}
        {tab === 'findings' ? (
          <>
            {settingsDirty ? (
              <p className="small muted">
                Tip: after changing rules on the Checks tab, run the checks again before exporting a report.
              </p>
            ) : null}
            <FindingsPanel />
          </>
        ) : null}
      </div>
    </div>
  )
}

function delimiterName(delimiter: string): string {
  if (delimiter === ',') return 'comma'
  if (delimiter === ';') return 'semicolon'
  if (delimiter === '\t') return 'tab'
  if (delimiter === '|') return 'pipe'
  return JSON.stringify(delimiter)
}
