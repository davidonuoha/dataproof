import { DATE_FORMATS, type ColumnType, type DateFormatId } from '../lib/types'
import { useSession } from '../state/session'
import { Callout } from './ui'

const TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Boolean (true/false)',
  unknown: 'Empty / unknown',
}

/**
 * Column inspection and correction.
 *
 * Automatic type detection is a convenience, not a verdict. Every column can be
 * re-assigned by hand, and date columns must have an explicit format before any
 * date value is judged.
 */
export function ColumnSettings() {
  const { dataset, settings, setColumnType, setDateFormat } = useSession()
  if (!dataset) return null
  const { profiles } = dataset

  return (
    <div>
      <Callout tone="plain" title="Types are detected automatically and can be corrected">
        <p style={{ marginBottom: 0 }}>
          Detection is based on the values in the column. It is a starting point, not a finding: a column of account
          numbers is text even though it looks numeric, and a column of years may be a category rather than a number.
          Changing a type changes how the checks read that column.
        </p>
      </Callout>

      <div className="table-wrap" style={{ maxHeight: 'none' }}>
        <table className="data" style={{ fontSize: '0.84rem' }}>
          <caption className="visually-hidden">Column profiles with editable types</caption>
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Detected</th>
              <th scope="col">Type in use</th>
              <th scope="col">Date format</th>
              <th scope="col">Non-empty</th>
              <th scope="col">Empty</th>
              <th scope="col">Distinct</th>
              <th scope="col">Examples</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.name}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>{profile.name}</th>
                <td>
                  <span className="badge neutral">{TYPE_LABELS[profile.detectedType]}</span>
                </td>
                <td>
                  <label className="visually-hidden" htmlFor={`type-${profile.name}`}>
                    Type for {profile.name}
                  </label>
                  <select
                    id={`type-${profile.name}`}
                    value={profile.type}
                    onChange={(event) => setColumnType(profile.name, event.target.value as ColumnType)}
                  >
                    {(Object.keys(TYPE_LABELS) as ColumnType[]).map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  {profile.userOverride ? <span className="tiny faint"> changed by you</span> : null}
                </td>
                <td>
                  {profile.type === 'date' ? (
                    <>
                      <label className="visually-hidden" htmlFor={`date-${profile.name}`}>
                        Date format for {profile.name}
                      </label>
                      <select
                        id={`date-${profile.name}`}
                        value={settings.dateFormats[profile.name] ?? ''}
                        onChange={(event) =>
                          setDateFormat(
                            profile.name,
                            event.target.value as DateFormatId,
                            event.target.value === '' ? 'auto' : 'user',
                          )
                        }
                      >
                        <option value="">Choose a format…</option>
                        {DATE_FORMATS.map((format) => (
                          <option key={format} value={format}>
                            {format}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
                <td className="nowrap">{profile.nonEmptyCount}</td>
                <td className="nowrap">
                  {profile.emptyCount}
                  {profile.emptyCount > 0 ? <span className="badge warning" style={{ marginLeft: 6 }}>missing</span> : null}
                </td>
                <td className="nowrap">{profile.distinctCount}</td>
                <td title={profile.examples.join(' · ')}>{profile.examples.join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        {profiles.filter((p) => p.userOverride).length} of {profiles.length} column type
        {profiles.length === 1 ? '' : 's'} changed by hand. Type and date-format changes take effect the next time the
        checks are run.
      </p>
    </div>
  )
}
