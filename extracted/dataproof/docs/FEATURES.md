# Features

A complete description of what DataProof does in version 0.1.0, what each check
actually tests, and what it cannot tell you.

- [1. CSV import](#1-csv-import)
- [2. Data quality checks](#2-data-quality-checks)
- [3. Dataset comparison](#3-dataset-comparison)
- [4. Findings dashboard](#4-findings-dashboard)
- [5. Report export](#5-report-export)
- [6. Sample datasets](#6-sample-datasets)

---

## 1. CSV import

### File selection

A file can be chosen by clicking the drop zone, activating it with the keyboard
(Enter or Space), or dragging a file onto it. The drop zone is a real button, so it is
reachable with Tab.

### Parsing

Parsing uses [PapaParse](https://www.papaparse.com/), a widely used and well-tested
CSV parser. DataProof adds four things on top of it.

**Delimiter detection.** Each candidate delimiter (comma, semicolon, tab, pipe) is
scored by how consistently it splits the first 25 non-empty lines into the same number
of fields. The delimiter that produces a consistent, multi-column result wins. Because
PapaParse does the splitting, commas inside quoted values do not confuse it.

**Header detection.** The first record is treated as a header row when every cell is
non-empty and no cell parses as a plain number. A repeated heading does not disqualify
a row — the duplication is reported as its own finding instead. The decision is
reported as an informational finding so it is never invisible, and there are two
buttons on the Data tab to re-read the file with the other interpretation.

**Malformed record detection.** PapaParse does not report field-count mismatches when
parsing without a header, so DataProof compares each record's field count with the
header's itself. A short row is padded with empty cells; a long row is truncated for
display. Either way the row number and the mismatch are reported, and the finding says
plainly that values in the affected record may have shifted between columns.

**Blank lines.** Removed, but their positions are tracked so that malformed-row
findings still point at the right place in the original file.

Quoted fields, embedded delimiters, embedded line breaks, doubled quotes and LF/CRLF/CR
line endings are all handled by the parser. A UTF-8 byte-order mark is detected and
removed, and the removal is noted.

### Column inspection and type correction

Every column gets a profile: detected type, non-empty count, empty count, distinct
value count, and up to five example values.

Detection is a convenience, not a verdict. It can be overridden column by column. The
detected types are:

| Type | Detected when |
| --- | --- |
| `number` | Every non-empty value parses as a number, or at least 75% do and there are at least two of them |
| `boolean` | Every non-empty value is `true`, `false`, `yes` or `no` |
| `date` | A single recognised date pattern fits at least 75% of the non-empty values |
| `text` | Anything else |
| `unknown` | The column is entirely empty |

The 75% thresholds are deliberate. A column of 200 amounts containing three `n/a`
entries is a numeric column with three unreadable values — treating it as text would
hide exactly the problem the journalist needs to see. This was originally an
all-or-nothing rule, and the regression test in `src/test/regression.test.ts` records
why it changed.

### Number interpretation

`parseNumber` is deliberately conservative, because a silently "fixed" number would
corrupt every downstream statistic.

| Input | Result | Why |
| --- | --- | --- |
| `42`, `-3.5`, `1.2e3` | `42`, `-3.5`, `1200` | Plain numeric forms |
| `1,234.5` | `1234.5` | Valid thousands grouping |
| `1 234 567` | `1234567` | Valid space grouping |
| `1,23` | `null` | Invalid grouping — not guessed |
| `(1,200)` | `-1200` | Accounting parentheses mean negative |
| `$1,000`, `NGN 500` | `1000`, `500` | Currency prefix stripped |
| `45%` | `45` | Percent sign stripped; the value is **not** divided by 100 |
| `007`, `0012` | `null` | Leading zeros signal an identifier, not a number |
| `n/a`, `not reported`, `-` | `null` | Not a number |

### Limits

Files above 60 MB are refused, with an explanation that says why and suggests splitting
the file. Between 15 MB and the limit the interface warns that processing will take
time. Parsing runs in a Web Worker so the interface stays responsive; if workers are
unavailable the same pure parsing function runs on the main thread and produces an
identical result.

The preview shows the first 200 records. Every record is checked.

---

## 2. Data quality checks

### A. Missing values

A cell is missing when, after trimming whitespace, it contains no characters. **Zero,
`false`, `0.00` and any text are present data.** Conflating them with missing data is
one of the most common and most damaging data-quality mistakes, and the test suite
locks the behaviour in.

Reported: total empty cells, empty cells per column, the percentage per column, the
rows containing empty cells, and the affected row numbers. Severity: **warning**.

### B. Duplicate detection

Two checks run.

- **Exact duplicates** — rows identical in every column.
- **Key duplicates** — rows that agree on the columns you select as the matching key.

Both report the affected row numbers and the values that caused the match. Both are
severities of **warning**, and the explanation says why: identical values do not prove
that two rows describe the same event.

**Nothing is ever deleted, merged or modified.** The finding's suggested next step
tells the journalist to check the source system before removing anything.

### C. Inconsistent categories

For each text column, values are normalised by trimming, lower-casing and collapsing
repeated whitespace. Normalised values that map to more than one original string are
reported, with every original variant and its row numbers.

Punctuation is deliberately preserved, because `Abuja (FCT)` and `Abuja FCT` may be
legitimately different reporting units. The finding states plainly that these are
suggestions, not errors, and that DataProof cannot tell which spelling is
authoritative.

### D. Date validation

A date column is only validated once one explicit format has been selected for it.
Until then DataProof reports that no format is set rather than guessing — guessing is
how `03/04/2024` silently becomes either 3 April or 4 March.

Supported formats: `YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`, `MM/DD/YYYY`,
`DD-MM-YYYY`, `MM-DD-YYYY`, `DD.MM.YYYY`, `DD MMM YYYY`, `MMM DD, YYYY`, and ISO
datetimes. Parsing is strict: month and day ranges are checked against the actual
number of days in the month, so `2024-02-31` and `29/02/2023` are rejected.

- Values that fail the selected format are reported verbatim. Severity is **error**
  when you selected the format yourself, **warning** when it was auto-detected.
- Values that would be valid under both a day-first and a month-first convention are
  reported as **ambiguous**, at **info** severity. They are never changed.
- The suggested next step recommends ISO 8601 in published data, which removes the
  ambiguity entirely.

### E. Numerical validation

For every numeric column:

- **Descriptive statistics** — count, minimum, maximum, mean, median, sample standard
  deviation, first and third quartiles, interquartile range. Quantiles use linear
  interpolation. Severity: **info**.
- **Unreadable values** — non-empty cells that do not parse as numbers. These rows are
  excluded from every statistic, and the finding says so. Severity: **warning**, or
  **error** if you set the column type to number yourself.
- **Negative values** — reported at **info**, with the note that negatives are
  legitimate for deficits, adjustments and net changes but suspicious in measures that
  cannot go below zero.
- **Zeros** — reported at **info**, with the explicit statement that zero is treated
  throughout DataProof as a recorded value, not as missing data.
- **Outliers** — see below.

#### Outlier detection and its limitations

Two methods, both transparent:

**Tukey's interquartile range rule (default).** The 25th and 75th percentiles are
computed; anything outside `Q1 − k·IQR` to `Q3 + k·IQR` is flagged. The default `k`
is 1.5, the conventional value. This method makes no assumption about the shape of the
distribution, which is why it is the default.

**Z-score.** Anything more than `k` sample standard deviations from the mean is
flagged. The conventional `k` is 3. This method assumes a roughly symmetric
distribution and is itself sensitive to extreme values.

The finding records the method, the threshold, the quartiles, the fences and the mean
and standard deviation, so the reader can reproduce the decision. It also states, in
the finding and in the export:

> Statistical outliers are defined relative to this dataset only. The method assumes
> nothing about the distribution and has no way to know whether an extreme value is
> correct. A value is never labelled incorrect because it is unusual.

Severity: **warning**. An outlier is the most newsworthy number in a dataset as often
as it is a typo.

### F. User-defined rules

| Rule | What it checks |
| --- | --- |
| Column must not be empty | Every cell is non-empty |
| Number must be within a range | Parses as a number and falls between the minimum and maximum; minimum-only and maximum-only are supported |
| Column must contain unique values | No value (ignoring empties) appears more than once; every row in a repeated group is reported |
| Value must belong to a permitted list | The value is in the list, matched case-insensitively after trimming |
| Number must be greater than or equal to zero | Parses as a number and is not negative |

Range and non-negative rules can be set to ignore empty cells, which should be covered
by a separate required-field rule.

These are the **only** findings that carry the `error` severity without further
interpretation, because the expectation came from the user. The finding says so, and
adds that a violation is an error only in the sense that the data contradicts the rule
you set — if the rule does not describe the real world, the finding is a false positive
and the rule should change.

### G. Cross-field consistency

A structured comparison builder, not an expression parser. You select:

- one or more **component columns**, which are summed;
- a **total column**, which the sum is compared against;
- a **tolerance**, absolute or as a percentage of the component sum;
- whether rows with any empty involved cell are skipped.

The formula is always rendered in words and repeated in the finding and the report:
`"Budget Allocation" should equal "Actual Expenditure" within 0 absolute units`.

DataProof only checks a relationship the user has stated. It never assumes that one
column should equal the sum of others, because in real datasets that is often false —
different reporting periods, rounding, partial components, out-of-scope items.

Severity: **error**, because the rule was user-defined. The uncertainty statement notes
that a mismatch does not by itself say which figure is wrong: the total, a component,
or the rule.

### H. Structural checks

Run before the value-level checks, because they concern the shape of the table:

- malformed records (field-count mismatch) — **error**;
- quoting problems reported by the parser — **error**;
- a file with no data rows — **error**;
- columns that are completely empty — **warning**;
- duplicate column headings — reported as a parse issue;
- columns named by position because no header was found — **info**;
- the header-row assumption itself — **info**.

---

## 3. Dataset comparison

Load an older and a newer version of a file. Both are parsed locally.

### Structure

Column names are compared directly. Additions and removals are reported, and a column
whose inferred type changed between versions (for example a numeric column that now
contains text) is flagged as a type change.

**A renamed column appears as one removal and one addition.** DataProof does not guess
that two differently named columns are "the same", because guessing would invent
comparisons the user never asked for. The limitation is stated in the result and in
the exported report, and there is a regression test locking the behaviour in.

### Records

Select one or more columns as the record identifier. Records are then matched on those
values — trimmed and case-insensitive — rather than on their position in the file.

Four outcomes are distinguished:

| Outcome | Meaning |
| --- | --- |
| **Added** | The key appears only in the newer dataset |
| **Removed** | The key appears only in the older dataset |
| **Changed** | The key appears in both, with at least one shared column differing |
| **Unchanged** | The key appears in both and every shared column matches |

Changed records show the before and after value for every column that differs.

### When there is no reliable identifier

If no identifier is selected, records are matched by row position. **This is stated
loudly**, in a finding and in the result's limitations:

> If records were inserted, deleted or reordered between versions, every subsequent row
> will look changed. Select one or more identifier columns for a reliable comparison.

If the identifier is not unique — a key repeats in one or both datasets — DataProof
pairs the repeated rows in file order, reports any surplus row as added or removed
rather than dropping it, and raises a warning that the pairing is not a reliable
identification. An earlier implementation silently discarded surplus rows; a regression
test now prevents that.

### Export

The comparison exports as JSON and as HTML, with the counts, the structure changes, the
findings, the limitations and the record-level differences.

---

## 4. Findings dashboard

### Summary

Total records analysed, total columns, total findings, a breakdown by severity, the
number of rows referenced by at least one finding, and the counts per category.

### Severity

| Level | Definition |
| --- | --- |
| **Error** | A clearly defined rule has been violated — either a rule you defined, or a date format you selected |
| **Warning** | A potential issue that requires investigation |
| **Information** | A useful observation that is not necessarily a problem |

### Filtering and inspection

Findings can be filtered by severity and category, and searched by title, explanation
or column name. Findings are sorted errors first, then warnings, then information.

Every finding with affected rows has an **Inspect** button that opens the records
behind it, shown from the original file with their original values and the affected
rows highlighted.

### What every finding contains

1. A short title.
2. A plain-language explanation.
3. The affected column or columns.
4. The affected row numbers.
5. The rule or statistical method used.
6. A suggested next step.
7. A statement of uncertainty where the evidence does not support certainty.

A test asserts that no finding is ever produced with an empty title, explanation,
method or next step.

---

## 5. Report export

### JSON

Machine-readable, indented, stable field names. Contains:

- tool name, version, description and the statement that processing is local;
- report type and generation timestamp (ISO 8601, UTC);
- a privacy block recording whether record values were included;
- dataset metadata: file name, size, delimiter, header assumption, record and column
  counts, column profiles, and every issue detected while parsing;
- the analysis settings: duplicate key, date formats, outlier method and threshold,
  validation rules and cross-field rules;
- the checks performed, in the order they run;
- the summary counts;
- every finding, with its method, next step, uncertainty and evidence;
- numerical statistics per column;
- the known limitations.

Affected rows appear as row numbers by default. Full record values are added only when
the user opts in.

### HTML

A self-contained document with embedded CSS. Readable, printable, and grouped by
category. Includes the dataset summary, the columns table, any import issues, the
findings, the numerical statistics, the methodology, the rules that were defined, and
the limitations.

It opens with the statement that the report is not proof that the data is accurate, and
it carries a privacy notice on its face describing whether record values are included.

Every dataset value is escaped before it reaches the markup.

### Record values

Off by default. When enabled, up to a configurable number of affected records per
finding are included with all their column values, and the report carries a warning to
treat the file with the same care as the original.

Note that finding *explanations* always quote a small number of example values (up to
20) so that each finding can be understood and checked. The privacy wording in the
report says exactly this rather than overclaiming.

---

## 6. Sample datasets

Three datasets load with one click from the Dashboard and the import screen, plus a
second version of the expenditure file for demonstrating comparison. All four are
entirely fictional.

| File | Records | Columns | Deliberately contains |
| --- | --- | --- | --- |
| `government-expenditure-2023.csv` | 24 | 4 | Empty cells, two duplicate records, a negative figure, a category written two ways, an outlier, an overspend |
| `election-results.csv` | 23 | 5 | Duplicate polling units, two code formats, a missing area, a missing vote count, an inconsistent state name, a malformed row with an extra field |
| `public-health.csv` | 30 | 4 | Empty cells, indicator names in several cases, text in a numeric column, a negative count, a placeholder value, a percentage above 100 |
| `government-expenditure-revised.csv` | 23 | 4 | A record added, a record removed, changed values, and a renamed column |

Every introduced issue is documented in [`SAMPLE-FINDINGS.md`](SAMPLE-FINDINGS.md),
which is generated by running the shipped checks over the shipped files. The test suite
asserts that the documented findings are still produced, so the documentation cannot
drift away from the behaviour.
