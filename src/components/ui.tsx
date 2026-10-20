import { useId, type ReactNode } from 'react'
import type { Severity } from '../lib/types'
import { SEVERITY_LABELS } from '../lib/types'

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge ${severity}`}>{SEVERITY_LABELS[severity]}</span>
}

export function Stat({
  value,
  label,
  tone,
  title,
}: {
  value: ReactNode
  label: string
  tone?: 'error' | 'warning' | 'info'
  title?: string
}) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`} title={title}>
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  )
}

export function Callout({
  tone = 'plain',
  title,
  children,
}: {
  tone?: 'plain' | 'info' | 'warning' | 'error'
  title?: string
  children: ReactNode
}) {
  return (
    <div className={`callout ${tone}`}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row tight" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="small">{label}</span> : null}
    </span>
  )
}

export function ProgressBar({ label }: { label: string }) {
  return (
    <div className="stack" role="status" aria-live="polite">
      <span className="small muted">{label}</span>
      <div className="progress">
        <span style={{ width: '100%', opacity: 0.5 }} />
      </div>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

export interface TabDefinition {
  id: string
  label: string
  badge?: number
}

export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: TabDefinition[]
  active: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 ? <span className="badge neutral" style={{ marginLeft: 8 }}>{tab.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="tiny muted" style={{ marginTop: 3, marginBottom: 0 }} id={`${id}-hint`}>{hint}</p> : null}
    </div>
  )
}

/** A definition list used inside finding cards and detail panels. */
export function DefinitionList({ items }: { items: Array<{ term: string; detail: ReactNode }> }) {
  return (
    <dl>
      {items.map((item) => (
        <div key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
