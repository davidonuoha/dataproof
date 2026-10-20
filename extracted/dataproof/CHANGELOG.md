# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — unreleased

The first release. CSV analysis and dataset comparison, running entirely in the browser.

### Added

**Import**
- CSV and plain-text import by click, keyboard or drag-and-drop.
- Delimiter detection across comma, semicolon, tab and pipe, scored by field-count
  consistency.
- Header-row detection with a manual override that re-reads the file.
- Malformed-record detection: field-count mismatches, quoting problems, blank-line
  handling and byte-order-mark removal.
- Column profiling: detected type, empty and non-empty counts, distinct values and
  examples.
- Conservative number interpretation covering grouped thousands, accounting
  parentheses, currency prefixes and percent signs, with leading zeros preserved as
  identifiers.
- Ten date formats with strict calendar validation.

**Checks**
- Missing-value detection per column and per row, treating zero, false and text as
  present data.
- Exact duplicate detection and key-based duplicate detection over user-selected
  columns.
- Category consistency detection for case and whitespace variants.
- Date validation against a user-selected format, with ambiguous dates reported and
  never resolved.
- Descriptive statistics, unreadable-value detection, negative-value reporting, zero
  reporting and outlier detection by Tukey's IQR rule or z-score.
- User-defined validation rules: required, numeric range, uniqueness, permitted list
  and non-negative.
- User-defined cross-field comparisons with an explicit formula, tolerance and
  percentage mode.
- Structural checks: malformed rows, quoting problems, empty datasets, empty columns,
  unnamed columns and the header assumption itself.

**Comparison**
- Column additions, removals and type changes.
- Record-level added, removed, changed and unchanged classification, matched on
  user-selected identifier columns.
- Before-and-after values for every changed column.
- Explicit warnings for positional matching, repeated identifiers and renamed columns.
- Surplus rows under a repeated identifier reported rather than discarded.

**Reporting**
- JSON export with dataset metadata, settings, checks performed, findings, statistics
  and limitations.
- Self-contained HTML export grouped by category, with methodology and limitations.
- Opt-in inclusion of affected record values, with a privacy notice.
- HTML escaping of every dataset value.

**Application**
- Five-section interface: Dashboard, Analyze Dataset, Compare Datasets, Reports and
  About DataProof.
- Findings dashboard with severity and category filters, search, and a record inspector
  that shows the original values behind any finding.
- Four fictional sample datasets with every introduced issue documented and asserted in
  the test suite.
- Responsive layout, keyboard navigation, labelled controls and live status regions.

**Privacy**
- No backend, no upload, no storage APIs, no analytics, no console logging of data and
  no code execution.

**Testing**
- 157 unit and component tests covering parsing, every check, comparison, report
  generation, malformed and empty input, preservation of legitimate zeros, and
  regression cases for bugs found during development.
- 10 browser tests covering import, findings inspection, rule creation, comparison,
  report download, the empty-file error and session clearing.
- Screenshot capture driven by Playwright, so the images in the documentation are
  produced by the running application.

### Known limitations

See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md). The significant ones: UTF-8 only, a
60 MB file cap, heuristic header and type detection, category matching limited to case
and whitespace, no matching across a renamed column, and no saved analysis settings.

[0.1.0]: https://github.com/your-org/dataproof/releases/tag/v0.1.0
