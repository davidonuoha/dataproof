# DataProof and existing tools

Before building DataProof, the relevant open-source projects were reviewed. Several of
them are mature, well maintained and better than this project at what they do. This
document records what already exists, what DataProof reuses, what it does differently,
and what remains unsolved.

**DataProof does not claim to be the first, the only, or the most advanced tool of its
kind.** It is a small, focused application with a specific audience, and it stands on
libraries and ideas that other people built.

## The landscape

### Cleaning and transforming data

**OpenRefine** (open source, Java, browser interface over a local server) is the
reference tool for cleaning messy tabular data. It provides faceting — group by a
column's values and see the counts — and clustering algorithms (key collision,
n-gram, Levenshtein, phonetic) that group similar text values and suggest merges. It
also does reconciliation against external knowledge bases, bulk transformations,
undo/redo history, and export to many formats.

*What DataProof takes from it:* the idea that category variants are worth surfacing
with their counts. DataProof's category check is a much simpler version of OpenRefine's
clustering, restricted to case and whitespace differences.

*How DataProof differs:* OpenRefine is built to transform data. Its core interaction is
"select these cells and change them". DataProof never modifies anything. It reports a
finding, points at the original records, and stops. For a journalist whose priority is
being able to defend a number in print, an unmodified file with a documented finding is
often more useful than a cleaned file whose provenance is unclear.

### Structural and schema validation

**csvlint** (Open Data Institute, Ruby, with a hosted service at csvlint.io) validates
CSV for readability and conformance. It checks structure — consistent field counts,
delimiters, quoting, line endings — and, optionally, validates against a schema in
either CSV on the Web (CSVW) or Data Package format. It reports errors and warnings and
can emit a badge. The hosted service deletes uploaded files immediately after
validation.

**Frictionless Framework** (Python; `goodtables` was renamed to `frictionless` from
version 3) validates tabular data against Table Schema. It produces a structured JSON
validation report with error categories — `source`, `structure`, `schema`, `custom` —
and supports custom checks, multiple formats (CSV, Excel, JSON, ODS and more), and
continuous validation in a publishing workflow.

*What DataProof takes from them:* the taxonomy of structural problems, and the idea that
a validation report should be machine-readable. DataProof's import issues are close in
spirit to csvlint's structural errors, and its JSON report is designed to be as
processable as a Frictionless report.

*How DataProof differs:* both are schema-first. They are at their best when somebody
has written down what a valid row looks like — which is exactly what a data publisher
does, and exactly what a reporter receiving an unexpected file does not have. DataProof
assumes no schema, infers what it can, and asks the user only for the expectations that
genuinely require human judgement (a date format, a duplicate key, a rule).

Both also lack the checks that matter most for a story: outliers, category spelling
variants, ambiguous dates, cross-field totals, and changes between two versions.

### Command-line inspection and diffing

**csvkit** (Python CLI) is a suite of utilities — `csvstat` for statistics, `csvclean`
for structural repair, `csvdedupe` for de-duplication, `csvjoin`, `csvsql`, `csvgrep`
and more. It is fast, scriptable and composes well with other tools.

**Table-diffing tools** — `daff`, `csvdiff` and similar — compare two versions of a
table and show cell-level differences.

*What DataProof takes from them:* the specific statistics that are useful for a first
look at a column, and the insight that a version-to-version diff is one of the most
valuable things you can do with a public dataset.

*How DataProof differs:* csvkit requires a terminal, and its output is numbers rather
than explanations. Diffing tools answer "what changed" but not "what does this change
mean for my analysis, and how reliable is this comparison". DataProof's comparison
raises a warning when records have to be matched by position rather than by an
identifier — the most common way a diff misleads — and states the limitation in the
exported report.

### Profiling and pipeline data quality

**ydata-profiling** (formerly pandas-profiling) generates a detailed HTML profiling
report for a dataframe: per-column distributions, correlations, missing-value maps,
duplicate counts.

**Great Expectations** and **Soda Core** are expectation-based data quality frameworks
for data engineering pipelines: you declare expectations, they run on a schedule, and
they alert when data drifts.

*What DataProof takes from them:* the value of a per-column profile, and the discipline
of writing down what "good" means before checking for it — which in DataProof becomes
the user-defined validation rules.

*How DataProof differs:* both are aimed at data a team owns and monitors repeatedly.
DataProof is aimed at a single unfamiliar file under deadline. It also takes a position
the pipeline tools deliberately do not: a statistical anomaly is not a failure, and the
tool should say so in the finding rather than leaving the reader to work it out.

## What DataProof reuses

The project does not reimplement solved problems.

| Capability | Library |
| --- | --- |
| CSV parsing — quoting, embedded delimiters, embedded newlines, line endings | [PapaParse](https://www.papaparse.com/) |
| User interface, rendering and escaping of untrusted text | [React](https://react.dev/) |
| Development server and production bundling | [Vite](https://vitejs.dev/) |
| Type system | [TypeScript](https://www.typescriptlang.org/) |
| Unit and component testing | [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/) |
| Browser testing and screenshot capture | [Playwright](https://playwright.dev/) |

Delimiter detection, header detection, number and date interpretation, the checks
themselves, the comparison and the report generation are written for this project.
Quantiles use the same linear-interpolation method as NumPy's default.

## What is distinctive

The differences are about the workflow and the tone of the output, not about
algorithms.

**It distinguishes a structural problem from an unusual value, and enforces the
distinction in code.** The `error` severity is reachable only by violating a rule the
user defined or a date format the user selected. Missing values, duplicates, category
variants and outliers are warnings or observations. Several checks carry a mandatory
`uncertainty` field that is printed in the finding and in the export.

**Nothing is ever modified.** There is no merge, no repair, no delete, no
normalisation. This is a product decision with a journalism rationale: the file the
analysis was run against must be the file that can be produced in a legal or editorial
dispute.

**Every finding explains itself.** Title, plain-language explanation, affected columns,
affected rows, the method used, a suggested next step, and an honest statement of
uncertainty. A check that reports a number without explaining it is rejected in review.

**The report is designed to be filed.** Every export records the file name, its
dimensions, the delimiter, the header assumption, the checks that ran, the statistical
method and its threshold, the rules that were defined, and the known limitations —
alongside the statement that the report is not proof that the data is accurate.

**It runs with no installation and no server.** A static folder. No account, no key, no
upload. For a reporter handling leaked documents or unpublished data, "the file never
leaves this laptop" is a requirement, not a preference.

**Comparison treats uncertainty as a first-class result.** Positional matching,
repeated identifiers and renamed columns each produce an explicit limitation rather
than a silently wrong answer.

## What remains unsolved

Honest gaps, some shared with every tool in this space.

- **Semantic equivalence of categories.** No tool reliably knows that `Greater Accra`
  and `GAR` are the same region. OpenRefine's clustering is the best available approach
  and it still needs a human to approve each merge.
- **Placeholders as missing data.** A dataset that uses `-99`, `N/A` or `unknown` for
  "not collected" will not have those reported as missing values by DataProof or by
  most validators. It requires domain knowledge that the file does not contain.
- **Correctness.** No tool can tell you whether a number is true. This is not a
  limitation to be fixed; it is the boundary between data validation and factual
  verification.
- **Cross-field rules at scale.** DataProof checks one total against the sum of
  components. Real accounting relationships — hierarchical totals, allocations across
  periods, percentage shares — need a rule language, and a rule language needs a
  parser, which is a much larger project.
- **Encoding.** DataProof assumes UTF-8. Mangled text from a Windows-1252 file is
  currently reported as a category inconsistency rather than as an encoding problem.
- **Institutional memory.** None of these tools remembers what the previous release
  looked like. Re-running the same checks on next quarter's file means re-entering the
  same settings. A portable, shareable rules file is the most obviously missing piece
  of the whole workflow.

## Summary

| Need | Best existing tool | DataProof |
| --- | --- | --- |
| Clean and transform messy data | OpenRefine | Not attempted |
| Validate against a published schema | csvlint, Frictionless | Not attempted |
| Inspect a CSV from the command line | csvkit | Not attempted |
| Profile a dataframe in depth | ydata-profiling | Partial — descriptive statistics only |
| Monitor data quality in a pipeline | Great Expectations, Soda | Not attempted |
| **Understand an unfamiliar file under deadline, without installing anything, and produce a defensible record of what was checked** | — | **This is the gap DataProof aims at** |

If you are choosing a tool: use OpenRefine to clean, csvlint or Frictionless to
validate against a schema you control, and csvkit when you live in a terminal. Use
DataProof when a file has arrived, nobody has told you what is in it, and you need to
know what is wrong with it before you build a chart on top of it.
