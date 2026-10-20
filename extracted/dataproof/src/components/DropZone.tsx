import { useRef, useState, type DragEvent } from 'react'

interface DropZoneProps {
  onFile: (file: File) => void
  title: string
  description?: string
  inputId: string
  disabled?: boolean
}

/**
 * File selection by click, keyboard or drag-and-drop.
 *
 * The drop zone is a real button so that it is reachable with Tab and
 * activatable with Enter or Space. The hidden file input carries the
 * accessible name used by screen readers.
 */
export function DropZone({ onFile, title, description, inputId, disabled }: DropZoneProps) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setOver(false)
    if (disabled) return
    const file = event.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={inputId}
        className="visually-hidden"
        type="file"
        accept=".csv,text/csv,text/plain"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      <p>
        <button type="button" className="primary" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Choose a CSV file
        </button>
      </p>
      <p className="tiny faint" style={{ marginBottom: 0 }}>
        …or drag a file onto this area. CSV and plain-text files only; nothing is uploaded to a server.
      </p>
    </div>
  )
}
