# Known limitations

Every tool has limits. This is the honest list for DataProof 0.1.0, with the reason for
each one and, where possible, a workaround.

## Scale and performance

**Files above 60 MB are refused.** The limit is a constant in `src/lib/csv.ts`
(`MAX_FILE_BYTES`). It exists because everything runs in one browser tab with no
server to fall back on. The error message says so and suggests splitting the file.

**Between 15 MB and 60 MB, expect a pause.** The interface warns, but the tab will be
busy.

**Parsing is off the main thread; the checks are not.** Parsing runs in a Web Worker so
the interface stays responsive while a large file is read. The checks then run
synchronously on the main thread, so the interface freezes briefly on a large file.
Moving the checks into the worker is the obvious next improvement.

**Memory is proportional to the file.** The whole table is held in memory as arrays of
strings. A 50 MB CSV will use several hundred megabytes.

**Results are truncated for display and export.** A finding lists up to 500 affected
row numbers (`MAX_ROWS_PER_FINDING`); a comparison keeps up to 5,000 record-level
differences (`MAX_COMPARISON_RECORDS`). In both cases the reported *counts* describe
the whole result — only the enumeration is capped — and the truncation is recorded in
the finding evidence and in the exported report.

**The preview shows 200 records.** All records are checked; only the preview is
limited.

## Input formats

**UTF-8 only.** Files with a byte-order mark are handled; files in Windows-1252,
Latin-1, UTF-16 or Shift-JIS may produce mangled text with no warning. There is no
encoding detection.

**No Excel workbooks.** `.xlsx` and `.xls` are not read. Save as *CSV UTF-8* first.
This is a deliberate scope decision, not an oversight: a spreadsheet reader is a large
dependency, and it would encourage people to analyse files whose formulas have not been
resolved.

**No PDF, image or OCR support.** Permanently out of scope.

**Delimiter detection is a heuristic.** It scores comma, semicolon, tab and pipe by how
consistently they split the first lines. A file with very irregular content, or a
single-column file, may be mis-detected. There is no manual delimiter override in the
interface yet.

## Detection accuracy

**Header detection is a heuristic.** A first row is treated as a header when all its
cells are non-empty and none parses as a number. A file with no header row whose first
record happens to be all text will be mis-read. The decision is always reported as a
finding, and there are buttons to re-read the file with the other interpretation.

**Column-type detection is a heuristic.** It uses a 75% threshold for numeric and date
columns. A column of mostly numbers with a few labels will be typed as numeric — which
is usually what you want, since the labels then get reported as unreadable values. But
it can be wrong, and it can be overridden column by column.

**Missing values are empty cells only.** A placeholder such as `N/A`, `-99`, `unknown`,
`null` or a lone hyphen is present data. DataProof will not report it as missing. A
future "treat these values as missing" setting would address this; it does not exist
yet.

**Category consistency is superficial.** It catches differences in letter case,
surrounding whitespace and repeated internal whitespace. It does not catch `Lagos` vs
`Lagos State`, `Greater Accra` vs `GAR`, `Ministry of Health` vs `Federal Ministry of
Health`, or a misspelling. It will not suggest that such pairs are the same thing,
because it cannot know.

**Date detection covers ten formats.** Anything else — `20240101`, `Q1 2024`,
`week 12`, non-Gregorian calendars — is not recognised. A column that is entirely
unrecognised is treated as text and will not be date-validated.

**Date values are never converted.** DataProof reports that a value does not match the
selected format; it does not re-interpret it, and it does not offer a "fix".

## Statistical limits

**Outliers are relative to the file.** Both methods describe the distribution of the
column as supplied. A column where every value is wrong but wrong consistently will
produce no outliers. A small column (fewer than about ten values) will produce unstable
quartiles.

**The z-score method assumes symmetry** and is itself distorted by extreme values.
That is why Tukey's IQR rule is the default.

**No distribution testing, no seasonality, no time-series analysis.** There is no
Benford's law check, no change-point detection, no trend analysis.

**Statistics cover only the values that parsed.** Rows with unreadable values are
excluded, and the finding says so. This means the reported mean is not the mean of the
column as published.

## Comparison limits

**A renamed column is not matched.** A rename appears as one removed and one added
column, and values are not compared across it. This is deliberate — guessing that two
differently named columns are the same would invent comparisons the user never asked
for — but it means a rename can hide a large number of value changes.

**Without an identifier, comparison is positional and fragile.** Row 1 is compared with
row 1. Any insertion, deletion or reordering makes every subsequent row look changed.
The result states this in a finding and in its limitations, but it is still the single
most likely source of a misleading conclusion in the whole application.

**A repeated identifier is paired in file order.** When a key matches several rows, they
are paired by position and any surplus is reported as added or removed. That is the
best available behaviour, but it is not a reliable identification, and the warning says
so.

**Values are compared as trimmed text.** `1,000` and `1000` are different values.
`0.10` and `0.1` are different values. Case differences count. There is no numeric or
fuzzy comparison mode.

**No three-way comparison.** Only two datasets at a time.

## Interface and workflow

**No saved settings.** Rules, duplicate keys, date formats and outlier settings live in
memory. Closing the tab loses them, and there is no way to re-run the same checks on
next quarter's release without re-entering them.

**No project or session history.** No list of previously analysed files.

**No charts.** Findings are text and tables. A histogram of a skewed column would
sometimes say more than a standard deviation.

**English only.** The interface and all finding text are in English.

**Keyboard and screen-reader support is good but not audited.** Buttons are real
buttons, form controls are labelled, status changes are announced and focus is always
visible — but the project has not been through a formal accessibility audit.

## Things it will never do

- Verify that a figure matches the real world.
- Fetch the source document or contact the publisher.
- Repair, clean, merge or correct data.
- Generate prose about the data.
- Upload anything to a server.
- Require an account, a key or a payment.

## Reporting a limitation you found

If you hit a limit that is not on this list, that is a documentation bug worth an
issue. If you hit one that *is* on the list and it matters for your work, also worth an
issue — the list is a plan as much as a confession.
