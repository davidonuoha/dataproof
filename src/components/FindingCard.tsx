import { CATEGORY_LABELS, type Finding } from '../lib/types'
import { SeverityBadge } from './ui'

const ROW_PREVIEW_LIMIT = 40

export function FindingCard({
  finding,
  onInspect,
}: {
  finding: Finding
  onInspect: (finding: Finding) => void
}) {
  const rowsText =
    finding.rows.length === 0
      ? null
      : finding.rows.slice(0, ROW_PREVIEW_LIMIT).join(', ') +
        (finding.rows.length > ROW_PREVIEW_LIMIT ? ` … and ${finding.rows.length - ROW_PREVIEW_LIMIT} more` : '')

  return (
    <article className={`finding ${finding.severity}`} id={`finding-${finding.id}`}>
      <h3>
        <SeverityBadge severity={finding.severity} />
        <span>{finding.title}</span>
      </h3>

      <p className="explanation">{finding.explanation}</p>

      <dl>
        <dt>Category</dt>
        <dd>{CATEGORY_LABELS[finding.category]}</dd>

        <dt>Column{finding.columns.length === 1 ? '' : 's'}</dt>
        <dd>{finding.columns.length > 0 ? finding.columns.join(', ') : '—'}</dd>

        <dt>Affected row{finding.rows.length === 1 ? '' : 's'}</dt>
        <dd className="rows">
          {rowsText ?? 'Not row-specific'}
          {finding.rows.length > 0 ? (
            <>
              {' '}
              <button type="button" className="link" onClick={() => onInspect(finding)}>
                Inspect {finding.rows.length} record{finding.rows.length === 1 ? '' : 's'}
              </button>
            </>
          ) : null}
        </dd>

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
  )
}
