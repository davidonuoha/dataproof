import { useEffect, useMemo, useState } from 'react'
import { DropZone } from '../components/DropZone'
import { Callout, EmptyState, SeverityBadge, Stat, Spinner } from '../components/ui'
import { downloadText, reportFileName } from '../lib/download'
import { buildHtmlComparisonReport } from '../lib/report/html'
import { buildJsonComparisonReport, serializeJsonReport } from '../lib/report/json'
import { SAMPLE_EXPENDITURE_REVISED, SAMPLE_GOVERNMENT_EXPENDITURE } from '../lib/sampleData'
import type { RecordChangeKind } from '../lib/types'
import { useSession } from '../state/session'

const KIND_LABELS: Record<RecordChangeKind, string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Unchanged',
}

export function Compare() {
  const {
    comparison,
    comparisonSides,
    comparisonBusy,
    loadComparisonSide,
    runComparison,
    clearComparison,
    exportOptions,
  } = useSession()

  const [keyColumns, setKeyColumns] = useState<string[]>([])
  const [kindFilter, setKindFilter] = useState<RecordChangeKind | 'differences'>('differences')

  const sharedHeaders = useMemo(() => {
    if (!comparisonSides.older || !comparisonSides.newer) return []
    return comparisonSides.older.headers.filter((h) => comparisonSides.newer?.headers.includes(h))
  }, [comparisonSides])

  useEffect(() => {
    if (!comparison) return
    setKeyColumns(comparison.keyColumns)
  }, [comparison])

  const loadSamplePair = async () => {
    await loadComparisonSide('older', SAMPLE_GOVERNMENT_EXPENDITURE.csv, 'expenditure-2023.csv', new Blob([SAMPLE_GOVERNMENT_EXPENDITURE.csv]).size)
    await loadComparisonSide('newer', SAMPLE_EXPENDITURE_REVISED.csv, 'expenditure-2024.csv', new Blob([SAMPLE_EXPENDITURE_REVISED.csv]).size)
  }

  const records = comparison?.records ?? []
  const visibleRecords =
    kindFilter === 'differences'
      ? records.filter((r) => r.kind !== 'unchanged')
      : records.filter((r) => r.kind === kindFilter)

  return (
    <div>
      <div className="page-intro">
        <h1>Compare two datasets</h1>
        <p className="lede">
          Load two versions of the same file to see which records were added, which were removed and which values
          changed. Both files are read locally.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Older version</h3>
          {comparisonSides.older ? (
            <div>
              <p className="small" style={{ marginBottom: 8 }}>
                <strong>{comparisonSides.older.fileName}</strong>
                <br />
                <span className="muted">
                  {comparisonSides.older.rows.length.toLocaleString()} records · {comparisonSides.older.headers.length} columns
                </span>
              </p>
              <button type="button" className="small" onClick={clearComparison}>
                Remove
              </button>
            </div>
          ) : (
            <DropZone
              inputId="compare-older"
              title="Load the older file"
              onFile={(file) => void file.text().then((text) => loadComparisonSide('older', text, file.name, file.size))}
            />
          )}
        </div>

        <div className="card">
          <h3>Newer version</h3>
          {comparisonSides.newer ? (
            <div>
              <p className="small" style={{ marginBottom: 8 }}>
                <strong>{comparisonSides.newer.fileName}</strong>
                <br />
                <span className="muted">
                  {comparisonSides.newer.rows.length.toLocaleString()} records · {comparisonSides.newer.headers.length} columns
                </span>
              </p>
              <button type="button" className="small" onClick={clearComparison}>
                Remove
              </button>
            </div>
          ) : (
            <DropZone
              inputId="compare-newer"
              title="Load the newer file"
              onFile={(file) => void file.text().then((text) => loadComparisonSide('newer', text, file.name, file.size))}
            />
          )}
        </div>
      </div>

      <p className="small muted">
        No two files ready?{' '}
        <button type="button" className="link" onClick={() => void loadSamplePair()} disabled={comparisonBusy}>
          Load the two fictional expenditure releases
        </button>{' '}
        — they contain a record added, a record removed, changed values and a renamed column.
      </p>

      {comparisonSides.older && comparisonSides.newer ? (
        <div className="card">
          <h3>Identifier columns</h3>
          <p className="small muted">
            Choose the column or columns that identify a single record. Records are then matched on those values rather
            than on their position in the file. Without an identifier, DataProof falls back to comparing row 1 with row 1,
            and warns you that the result is unreliable if rows were inserted or removed.
          </p>
          {sharedHeaders.length === 0 ? (
            <Callout tone="error" title="The two files have no column names in common">
              <p style={{ marginBottom: 0 }}>
                The files do not share a single column heading, so no record can be matched by identifier. Check that the
                correct files were loaded, or compare them as two separate analyses instead.
              </p>
            </Callout>
          ) : (
            <div className="scroll-box" role="group" aria-label="Identifier columns">
              {sharedHeaders.map((header) => (
                <label className="checkline" key={header}>
                  <input
                    type="checkbox"
                    checked={keyColumns.includes(header)}
                    onChange={() =>
                      setKeyColumns((current) =>
                        current.includes(header) ? current.filter((c) => c !== header) : [...current, header],
                      )
                    }
                  />
                  <span className="mono">{header}</span>
                </label>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primary"
              disabled={comparisonBusy || sharedHeaders.length === 0}
              onClick={() => runComparison(keyColumns)}
            >
              {comparisonBusy ? 'Comparing…' : 'Compare datasets'}
            </button>
            {keyColumns.length === 0 ? (
              <span className="small muted">No identifier selected — records will be matched by row position.</span>
            ) : (
              <span className="small muted">Matching on {keyColumns.join(' + ')}</span>
            )}
            {comparisonBusy ? <Spinner /> : null}
          </div>
        </div>
      ) : null}

      {comparison ? (
        <div>
          <h2>Comparison result</h2>
          <div className="grid-stats" style={{ marginBottom: 18 }}>
            <Stat value={comparison.counts.added} label="Records added" tone="info" />
            <Stat value={comparison.counts.removed} label="Records removed" tone="warning" />
            <Stat value={comparison.counts.changed} label="Records changed" tone="warning" />
            <Stat value={comparison.counts.unchanged} label="Records unchanged" />
          </div>

          <p className="small muted">
            Matched by{' '}
            {comparison.alignment === 'key'
              ? `identifier: ${comparison.keyColumns.join(' + ')}`
              : 'row position (no identifier was selected)'}
            . Compared on every shared column; values are compared as trimmed text.
          </p>

          {comparison.limitations.length > 0 ? (
            <Callout tone="warning" title="Limitations of this comparison">
              <ul style={{ marginBottom: 0 }}>
                {comparison.limitations.map((limitation) => (
                  <li key={limitation} className="small">
                    {limitation}
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}

          {comparison.columnChanges.length > 0 ? (
            <>
              <h3>Structure changes</h3>
              <div className="table-wrap" style={{ maxHeight: 'none' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">Column</th>
                      <th scope="col">Change</th>
                      <th scope="col">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.columnChanges.map((change) => (
                      <tr key={`${change.change}-${change.name}`}>
                        <td className="mono">{change.name}</td>
                        <td>{change.change}</td>
                        <td>
                          {change.change === 'type-changed'
                            ? `${change.previousType} → ${change.newType}`
                            : change.change === 'added'
                              ? 'Present only in the newer dataset'
                              : 'Present only in the older dataset'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <h3>Findings from the comparison</h3>
          {comparison.findings.map((finding) => (
            <article className={`finding ${finding.severity}`} key={finding.id}>
              <h3>
                <SeverityBadge severity={finding.severity} />
                <span>{finding.title}</span>
              </h3>
              <p className="explanation">{finding.explanation}</p>
              <dl>
                <dt>Rule or method used</dt>
                <dd>{finding.method}</dd>
                <dt>Suggested next step</dt>
                <dd>{finding.nextStep}</dd>
                {finding.uncertainty ? (
                  <>
                    <dt>What this finding does not establish</dt>
                    <dd>{finding.uncertainty}</dd>
                  </>
                ) : null}
              </dl>
            </article>
          ))}

          <h3>Record-level differences</h3>
          <div className="filters">
            <div className="filter-group">
              <label htmlFor="kind-filter">Show</label>
              <select
                id="kind-filter"
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as RecordChangeKind | 'differences')}
              >
                <option value="differences">All differences</option>
                <option value="added">Added only</option>
                <option value="removed">Removed only</option>
                <option value="changed">Changed only</option>
                <option value="unchanged">Unchanged only</option>
              </select>
            </div>
          </div>

          {visibleRecords.length === 0 ? (
            <EmptyState title="No records in this category">
              <p>Try a different filter.</p>
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Change</th>
                    <th scope="col">Identifier</th>
                    <th scope="col">Row (older)</th>
                    <th scope="col">Row (newer)</th>
                    <th scope="col">Before → after</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.slice(0, 500).map((record, index) => (
                    <tr key={`${record.kind}-${record.key}-${index}`}>
                      <td>
                        <span className={`badge ${record.kind === 'changed' ? 'warning' : record.kind === 'unchanged' ? 'neutral' : 'info'}`}>
                          {KIND_LABELS[record.kind]}
                        </span>
                      </td>
                      <td className="mono">{record.key}</td>
                      <td>{record.oldRow ?? '—'}</td>
                      <td>{record.newRow ?? '—'}</td>
                      <td style={{ whiteSpace: 'normal' }}>
                        {record.changes.length === 0
                          ? '—'
                          : record.changes.map((change) => (
                              <div key={change.column}>
                                <strong>{change.column}:</strong> <span className="mono">{change.before || 'empty'}</span> →{' '}
                                <span className="mono">{change.after || 'empty'}</span>
                              </div>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visibleRecords.length > 500 ? (
            <p className="small muted">
              Showing the first 500 of {visibleRecords.length} rows. The exported report contains up to{' '}
              {records.length.toLocaleString()} records.
            </p>
          ) : null}

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Export this comparison</h3>
            <p className="small muted">
              The comparison report lists structure changes, counts, findings, limitations and the changed records.
            </p>
            <div className="row">
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    reportFileName('dataproof-comparison', `${comparison.oldName}-vs-${comparison.newName}`, 'json'),
                    serializeJsonReport(
                      buildJsonComparisonReport(comparison, comparisonSides.older!, comparisonSides.newer!, exportOptions),
                    ),
                    'application/json',
                  )
                }
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    reportFileName('dataproof-comparison', `${comparison.oldName}-vs-${comparison.newName}`, 'html'),
                    buildHtmlComparisonReport(comparison, comparisonSides.older!, comparisonSides.newer!, exportOptions),
                    'text/html',
                  )
                }
              >
                Download HTML
              </button>
            </div>
          </div>
        </div>
      ) : (
        !comparisonBusy &&
        (!comparisonSides.older || !comparisonSides.newer) && (
          <EmptyState title="Load two files to compare">
            <p>Once both versions are loaded, choose an identifier column and run the comparison.</p>
          </EmptyState>
        )
      )}
    </div>
  )
}
