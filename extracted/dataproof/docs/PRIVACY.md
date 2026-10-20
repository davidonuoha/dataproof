# Privacy and data handling

DataProof is built so that analysing a sensitive dataset is safe by default. This
document describes exactly what happens to a file, what is stored, what is not, and
where the boundaries of the guarantee lie.

## Summary

| Question | Answer |
| --- | --- |
| Is my file uploaded anywhere? | No. |
| Is there a server? | No. The built application is static files. |
| Is my file written to disk? | No. It is held in memory for the life of the tab. |
| Is anything written to `localStorage`, cookies or IndexedDB? | No. |
| Does anything collect analytics or telemetry? | No. |
| Are dataset values logged to the console? | No. |
| Do I need an account or a key? | No. |
| Does it work offline? | Yes, once built. |
| What clears my data? | Closing or reloading the tab, or the **Clear session** button. |
| Are values included in exported reports? | Not by default. It is an explicit opt-in. |

## Where the data goes

### Reading the file

The file is read with the browser's File API (`File.text()`). The bytes never leave the
browser process. The text is passed to a Web Worker for parsing; a worker is a
separate thread inside the same page, not a network destination.

### Parsing

PapaParse parses the text into an array of arrays. The result is a plain JavaScript
object held in the memory of the tab.

### Checking

The checks are pure functions over that object. They read values and return findings.
They do not mutate the table.

### Displaying

Values are rendered into the DOM by React, which escapes text content. Where markup is
constructed as a string — only in the exported HTML report — every value passes
through `escapeHtml` in `src/lib/html.ts`.

### Exporting

A report is assembled as a string in memory, wrapped in a `Blob`, and handed to the
browser's download mechanism through a temporary object URL, which is revoked shortly
after. No report is sent anywhere; it is saved to the user's own disk.

### Clearing

The **Clear session** button (in the header, on the Analyze screen and on the Reports
screen) resets the dataset, the settings, the findings and any comparison to their
initial empty state. Reloading or closing the tab has the same effect.

## What is deliberately absent

- **No backend.** There is no server component, no API and no database. There is
  nothing that could receive a dataset even if it were configured to.
- **No analytics.** No page-view tracking, no error reporting service, no session
  recording, no heatmaps.
- **No remote fonts or assets.** The stylesheet uses the operating system's own font
  stack, so the page makes no third-party requests.
- **No persistent storage.** `localStorage`, `sessionStorage`, cookies and IndexedDB
  are not used. This is why there is no "resume where you left off" — a deliberate
  trade of convenience for the guarantee that nothing survives the tab.
- **No console logging of data.** Values are never written to the developer console.
- **No code execution.** Spreadsheet formulas are never evaluated. Cross-field
  comparisons use a structured builder rather than an expression parser, so there is
  no path from a file or a user input to `eval` or `new Function`.

## Reports and record values

A report is written for two audiences: a machine reading JSON, and an editor reading
HTML. Both are designed to be useful without reproducing the dataset.

**By default, no records are reproduced.** Reports contain row numbers, aggregate
statistics, column profiles and findings. A journalist can file the report alongside a
story without it becoming a second copy of a sensitive dataset.

**Finding explanations quote example values.** Up to 20 per finding, because a finding
that says "some values could not be parsed" without showing one is not actionable. This
is a deliberate, bounded exception, and the privacy notice printed in the report
describes it accurately rather than claiming that no values are present at all.

**Including record values is opt-in.** The *Reports* screen has a checkbox. When it is
enabled:

- up to a configurable number of affected records per finding are included, with all of
  their column values;
- the exported HTML report shows a prominent privacy notice;
- the JSON report records `privacy.includedRecordValues: true` and a note.

Anyone analysing leaked documents, individual-level records, unpublished contract data
or anything else sensitive should leave this off, or export the JSON without values and
share only the HTML summary.

## HTML escaping

Uploaded data is untrusted input. A CSV cell can contain `<script>alert(1)</script>`,
`"><img src=x onerror=...>`, or any other payload.

Every value that reaches an exported HTML report passes through `escapeHtml`, which
replaces `&`, `<`, `>`, `"` and `'`. There is no use of `innerHTML` or
`dangerouslySetInnerHTML` anywhere in the application. Values rendered by React in the
interface are escaped by React itself.

CSV exports use `escapeCsv`, which quotes cells containing a delimiter, a quote or a
line break and doubles embedded quotes.

There is a test in `src/test/report.test.ts` that builds a report from a dataset
containing a script tag and asserts that the escaped form appears and the raw form does
not.

## Practical limits of the guarantee

The architecture protects the dataset from DataProof and from any server DataProof
talks to. It does not protect the dataset from:

- **other software on the computer** — backups, synchronisation clients, endpoint
  monitoring;
- **browser extensions** with permission to read page content;
- **someone with access to the machine**;
- **the exported report**, if record values were enabled;
- **a compromised static host**, if the application is served from one. DataProof is
  static files, so its integrity depends on where it is deployed. For sensitive work,
  build it yourself and run it from a local folder.

DataProof cannot protect a dataset from the environment it is opened in.

## For maintainers

If you contribute a change that adds a network request, a storage API, an analytics
call, or any path from dataset content to executable code, it will not be merged. The
privacy guarantees in this document are part of the product's specification, not an
implementation detail.
