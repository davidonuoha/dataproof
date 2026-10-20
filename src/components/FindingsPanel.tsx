import { useMemo, useState } from 'react'
import { FindingCard } from './FindingCard'
import { DataTable } from './DataTable'
import { Callout, EmptyState, SeverityBadge, Stat } from './ui'
import { CATEGORY_LABELS, type Finding, type FindingCategory, type Severity } from '../lib/types'
import { useSession } from '../state/session'

/**
 * The findings dashboard: summary counts, filtering, the findings themselves,
 * and an inspector that shows the exact records behind a finding.
 */
export function FindingsPanel() {
  const { analysis, dataset, settingsDirty, runChecks, status } = useSession()
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<FindingCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [inspected, setInspected] = useState<Finding | null>(null)

  const findings = analysis?.findings ?? []

  const categories = useMemo(() => {
    const set = new Set<FindingCategory>()
    for (const finding of findings) set.add(finding.category)
    return [...set].sort()
  }, [findings])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return findings.filter((finding) => {
      if (severityFilter !== 'all' && finding.severity !== severityFilter) return false
      if (categoryFilter !== 'all' && finding.category !== categoryFilter) return false
      if (needle === '') return true
      return (
        finding.title.toLowerCase().includes(needle) ||
        finding.explanation.toLowerCase().includes(needle) ||
        finding.columns.some((c) => c.toLowerCase().includes(needle))
      )
    })
  }, [findings, severityFilter, categoryFilter, query])

  if (!analysis || !dataset) {
    return (
      <EmptyState title="No analysis yet">
        <p>Import a dataset and run the checks to see findings here.</p>
      </EmptyState>
    )
  }

  const inspectedRows = inspected
    ? inspected.rows.map((rowNumber) => dataset.table.rows[rowNumber - 1] ?? []).filter((row) => row.length > 0)
    : []
  const inspectedRowNumbers = inspected ? inspected.rows : []

  return (
    <div>
      {settingsDirty ? (
        <Callout tone="warning" title="These results are out of date">
          <p>
            The checks were run with different settings. Run them again to reflect your changes.{' '}
            <button type="button" className="link" onClick={runChecks} disabled={status === 'analyzing'}>
              Run checks now
            </button>
          </p>
        </Callout>
      ) : null}

      <h2>Findings</h2>
      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <Stat value={analysis.summary.findingCount} label="Findings" />
        <Stat value={analysis.summary.bySeverity.error} label="Errors" tone="error" title="A rule you defined was violated" />
        <Stat value={analysis.summary.bySeverity.warning} label="Warnings" tone="warning" title="Requires investigation" />
        <Stat value={analysis.summary.bySeverity.info} label="Information" tone="info" title="An observation, not necessarily a problem" />
        <Stat value={analysis.summary.affectedRowCount} label="Rows affected" />
        <Stat value={analysis.summary.recordCount} label="Records analysed" />
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="filter-severity">Severity</label>
          <select
            id="filter-severity"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as Severity | 'all')}
          >
            <option value="all">All severities</option>
            <option value="error">Errors only</option>
            <option value="warning">Warnings only</option>
            <option value="info">Information only</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as FindingCategory | 'all')}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="filter-query">Search</label>
          <input
            id="filter-query"
            type="search"
            style={{ width: '100%' }}
            placeholder="Search titles, explanations and column names"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <p className="small muted">
        Showing {filtered.length} of {findings.length} finding{findings.length === 1 ? '' : 's'}.
        {filtered.length > 0 ? ' Errors are listed first, then warnings, then information.' : ''}
      </p>

      {findings.length === 0 ? (
        <EmptyState title="No findings">
          <p>
            The checks that ran produced no findings. That means the dataset is internally consistent with respect to
            those checks — it is not evidence that the figures are correct.
          </p>
        </EmptyState>
      ) : null}

      {findings.length > 0 && filtered.length === 0 ? (
        <EmptyState title="No findings match the current filters">
          <p>Adjust the filters or clear the search box to see the other findings.</p>
        </EmptyState>
      ) : null}

      {inspected ? (
        <section className="card" aria-live="polite">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>
                <SeverityBadge severity={inspected.severity} /> Affected records: {inspected.title}
              </h3>
              <p className="small muted" style={{ marginBottom: 0 }}>
                {inspected.rows.length} row{inspected.rows.length === 1 ? '' : 's'} highlighted below, shown from the
                original file with the original values.
              </p>
            </div>
            <button type="button" onClick={() => setInspected(null)}>
              Close inspector
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <DataTable
              headers={dataset.table.headers}
              rows={inspectedRows}
              highlightRows={new Set(inspectedRowNumbers)}
              pageSize={25}
              caption={`Records affected by: ${inspected.title}`}
            />
          </div>
        </section>
      ) : null}

      {filtered.map((finding) => (
        <FindingCard
          key={finding.id}
          finding={finding}
          onInspect={(target) => {
            setInspected(target)
            window.requestAnimationFrame(() => {
              document.getElementById('inspected-records')?.scrollIntoView({ block: 'start' })
            })
          }}
        />
      ))}
    </div>
  )
}
