import { useEffect, useMemo, useState } from 'react'

interface DataTableProps {
  headers: string[]
  rows: string[][]
  /** 1-based data row numbers to highlight. */
  highlightRows?: Set<number>
  pageSize?: number
  caption?: string
  emptyMessage?: string
  /** Called with the 1-based row number when a row is activated. */
  onRowClick?: (rowNumber: number) => void
}

export function DataTable({
  headers,
  rows,
  highlightRows,
  pageSize = 50,
  caption,
  emptyMessage = 'No records to display.',
  onRowClick,
}: DataTableProps) {
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  useEffect(() => {
    if (page > pageCount - 1) setPage(0)
  }, [page, pageCount])

  const visible = useMemo(() => {
    const start = page * pageSize
    return rows.slice(start, start + pageSize).map((row, offset) => ({ row, rowNumber: start + offset + 1 }))
  }, [rows, page, pageSize])

  if (rows.length === 0) {
    return <p className="muted">{emptyMessage}</p>
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="table-wrap">
        <table className="data">
          {caption ? <caption className="visually-hidden">{caption}</caption> : null}
          <thead>
            <tr>
              <th scope="col" className="row-number">Row</th>
              {headers.map((header) => (
                <th scope="col" key={header} title={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, rowNumber }) => {
              const highlight = highlightRows?.has(rowNumber)
              return (
                <tr
                  key={rowNumber}
                  className={highlight ? 'highlight' : undefined}
                  onClick={onRowClick ? () => onRowClick(rowNumber) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  <td className="row-number">{rowNumber}</td>
                  {headers.map((header, index) => {
                    const value = row[index] ?? ''
                    return (
                      <td
                        key={header}
                        className={value === '' ? 'empty-cell' : undefined}
                        title={value === '' ? 'Empty cell' : value}
                      >
                        {value === '' ? 'empty' : value}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="row between small">
          <span className="muted">
            Showing rows {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}
          </span>
          <span className="row tight">
            <button type="button" className="small" onClick={() => setPage(0)} disabled={page === 0}>
              First
            </button>
            <button type="button" className="small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              Previous
            </button>
            <span className="muted nowrap">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="small"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              Next
            </button>
            <button
              type="button"
              className="small"
              onClick={() => setPage(pageCount - 1)}
              disabled={page >= pageCount - 1}
            >
              Last
            </button>
          </span>
        </div>
      ) : null}
    </div>
  )
}
