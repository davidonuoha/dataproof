# Documented sample findings

Every dataset under `samples/` is **fictional**. The tables below were produced by
running the shipped checks over the shipped files, so they are a record of what the
application actually reports rather than a description of what it is meant to report.

Reproduce them with:

```bash
npm test -- src/test/samples.test.ts
```

The severity shown is the severity DataProof assigns. Note how few findings are
`Error`: an error is reserved for a rule that was explicitly defined and then
violated. Everything else is a warning or an observation.


## Government expenditure (fictional)

`samples/government-expenditure-2023.csv` — 24 records, 4 columns.

A fictional budget execution table for a national government. Columns: Department, Financial Year, Budget Allocation, Actual Expenditure. Contains empty cells, a repeated record, a negative figure, a value an order of magnitude above its peers, a department written in two different ways, and a row whose actual expenditure exceeds its allocation.

### Issues deliberately built into the file

- Row 5: Actual Expenditure is empty (missing value).
- Row 6: exact duplicate of row 3 (Education, 2022/2023).
- Row 9: "water resources" is lower case where other rows use "Water Resources" (inconsistent category).
- Row 10: Actual Expenditure is negative (-25,000,000).
- Row 15: actual expenditure (7,020,000,000) exceeds the budget allocation (6,800,000,000).
- Row 22: Budget Allocation is empty (missing value).
- Row 23: Actual Expenditure (32,500,000,000) is roughly eight times the allocation and far above every other transport figure (outlier). An extra digit is the likely explanation, but DataProof reports it for investigation rather than calling it wrong.
- Row 21: exact duplicate of row 13 (Water Resources, 2023/2024).

### What DataProof reports

| Severity | Category | Finding | Rows |
| --- | --- | --- | --- |
| warning | categories | Column "Department" has 1 value written in more than one way | 1, 8, 12, 21 |
| warning | duplicates | 2 groups of identical rows (2 extra rows) | 2, 6, 12, 21 |
| warning | missing | 2 empty cells across 2 rows | 5, 22 |
| warning | missing | Column "Actual Expenditure" has 1 empty cell | 5 |
| warning | missing | Column "Budget Allocation" has 1 empty cell | 22 |
| warning | numeric | 1 potential outlier in "Actual Expenditure" | 23 |
| info | numeric | "Actual Expenditure": 23 numeric values, min -25,000,000, max 32,500,000,000 | — |
| info | numeric | "Budget Allocation": 23 numeric values, min 640,000,000, max 9,100,000,000 | — |
| info | numeric | 1 negative value in "Actual Expenditure" | 10 |
| info | structure | First record was read as the header row | — |

Totals: 10 findings — 0 error(s), 6 warning(s), 4 observation(s); 10 of 24 rows are referenced by at least one finding.

## Public health statistics (fictional)

`samples/public-health.csv` — 30 records, 4 columns.

A fictional public health indicator table. Columns: Region, Reporting Period, Indicator, Reported Value. Contains empty cells, indicator names written in several different ways, an unusual value, a value outside the plausible range for its indicator and a reporting period that cannot be read as a date.

### Issues deliberately built into the file

- Row 6: Reported Value is empty (missing value).
- Row 4: "facility deliveries" is lower case where other rows use "Facility deliveries".
- Row 14: "measles vaccination coverage" is lower case where other rows use "Measles vaccination coverage".
- Row 16: Measles vaccination coverage is 118.6, above 100 percent — plausible only if the indicator is not a percentage.
- Row 20: Reported Value is "not reported" (text in a numeric column).
- Row 24: Outpatient visits is negative (-320).
- Row 30: Outpatient visits is 999999, a placeholder-style value and an outlier.
- Rows 11-20: Reporting Period values are dates, so the column can be validated against YYYY-MM-DD.

### What DataProof reports

| Severity | Category | Finding | Rows |
| --- | --- | --- | --- |
| warning | categories | Column "Indicator" has 2 values written in more than one way | 1, 2, 3, 4, 5, 6, 7, 8 … |
| warning | missing | 1 empty cell across 1 row | 6 |
| warning | missing | Column "Reported Value" has 1 empty cell | 6 |
| warning | numeric | 1 value in "Reported Value" cannot be read as a number | 20 |
| warning | numeric | 3 potential outliers in "Reported Value" | 25, 26, 30 |
| info | numeric | "Reported Value": 28 numeric values, min -320, max 999,999 | — |
| info | numeric | 1 negative value in "Reported Value" | 24 |
| info | structure | First record was read as the header row | — |

Totals: 8 findings — 0 error(s), 5 warning(s), 3 observation(s); 24 of 30 rows are referenced by at least one finding.

## Election results (fictional)

`samples/election-results.csv` — 23 records, 5 columns.

A fictional election results extract. Columns: State, Local Government Area, Polling Unit ID, Candidate, Votes Recorded. Contains a repeated polling unit, a polling unit code written in two formats, a missing local government area, a missing vote count and a row with an extra field. No candidate, party or real election is represented.

### Issues deliberately built into the file

- Row 3: exact duplicate of row 2 (polling unit AN-001-01-002).
- Row 5: polling unit code AN00201001 uses a different format from every other code (AN-002-01-001).
- Row 7: Local Government Area is empty (missing value).
- Row 8: Votes Recorded is empty (missing value).
- Row 11: State "lagos" is lower case where other rows use "Lagos" (inconsistent category).
- Row 20: the record has an extra field ("provisional") beyond the header, so it is a malformed row.
- Row 23: exact duplicate of row 9 (polling unit LA-001-01-001).
- Polling unit LA-001-01-001 appears twice, so it is also a key-based duplicate.

### What DataProof reports

| Severity | Category | Finding | Rows |
| --- | --- | --- | --- |
| error | structure | 1 row have a different number of fields from the header | 20 |
| warning | categories | Column "State" has 1 value written in more than one way | 9, 10, 11, 12, 13, 14, 15, 23 |
| warning | duplicates | 2 groups of identical rows (2 extra rows) | 2, 3, 9, 23 |
| warning | duplicates | 2 groups of rows share the same "Polling Unit ID" | 2, 3, 9, 23 |
| warning | missing | 2 empty cells across 2 rows | 7, 8 |
| warning | missing | Column "Local Government Area" has 1 empty cell | 7 |
| warning | missing | Column "Votes Recorded" has 1 empty cell | 8 |
| info | numeric | "Votes Recorded": 22 numeric values, min 143, max 540 | — |
| info | structure | First record was read as the header row | — |

Totals: 9 findings — 1 error(s), 6 warning(s), 2 observation(s); 13 of 23 rows are referenced by at least one finding.

## Comparison: Government expenditure — revised release (fictional)

Load `samples/government-expenditure-2023.csv` as the older file and
`samples/government-expenditure-revised.csv` as the newer file, then match on
**Department** + **Financial Year**.

### Issues deliberately built into the file

- The column "Actual Expenditure" was renamed to "Expenditure Actual". DataProof reports this as one removed column and one added column, and does NOT compare values across a rename, so changes inside that column are not detected.
- Digital Economy, 2023/2024 is a record added in the revised release.
- The 2022/2023 Health row with the negative expenditure is absent, so it is a removed record. The identifier Health + 2022/2023 repeats in the older file, so the surplus row is reported as removed and the duplicate-key warning is raised.
- Health, 2023/2024 budget allocation changed from empty to 6,900,000,000 (a changed value in a shared column).
- Works and Housing, 2023/2024 budget allocation changed from 3,200,000,000 to 3,350,000,000 (a changed value in a shared column).
- Transport, 2023/2024 expenditure changed from 32,500,000,000 to 4,105,000,000. Because the column was renamed, the comparison cannot match it, so this change is not reported — a reminder to check for renamed columns before relying on a comparison.

### What DataProof reports

| Change | Identifier | Older row | Newer row |
| --- | --- | --- | --- |
| added | Digital Economy \| 2023/2024 | — | 23 |
| removed | Education \| 2022/2023 | 6 | — |
| removed | Health \| 2022/2023 | 10 | — |
| changed | Health \| 2023/2024 | 22 | 20 |
| changed | Works and Housing \| 2023/2024 | 17 | 15 |

Counts: 1 added, 2 removed, 2 changed, 20 unchanged. Column changes: `Expenditure Actual` (added), `Actual Expenditure` (removed).

### Limitations this comparison demonstrates

- The selected identifier is not unique: 6 key value(s) repeat in the older dataset and 4 repeat in the newer dataset. Where a key repeats, the rows are paired in file order and any surplus row is reported as added or removed. Verify those records individually.

