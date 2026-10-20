# Contributing to DataProof

Thank you for considering a contribution. This project exists to help journalists
avoid publishing corrections, so the bar for a new check is not "does it compute the
right number" but "does it tell the journalist something they can act on, and does it
tell the truth about what it does not know".

## Getting set up

```bash
git clone https://github.com/your-org/dataproof.git
cd dataproof
npm install
npm run dev
```

Before opening a pull request:

```bash
npm test        # unit and component tests
npm run build   # type-check and production build
```

If you touched anything in the interface, also run the browser tests:

```bash
npx playwright install chromium   # once
npm run test:e2e
```

## The five rules for a new check

These are not style preferences. A pull request that breaks one of them will be sent
back.

1. **Explain the finding in plain language.** Every finding needs a title, an
   explanation that a non-programmer can follow, the rule or method used, a suggested
   next step, and — where the evidence is not conclusive — a statement of what the
   finding does *not* establish.

2. **Never call a value incorrect because it is statistically unusual.** Outliers are
   reported as observations requiring investigation. The only findings that may carry
   the `error` severity are violations of a rule the user explicitly defined, or a
   value that contradicts a date format the user explicitly selected.

3. **Never modify the data.** No merging, repairing, deleting, reordering or
   normalising. Findings point at the original records with their original values.

4. **Preserve zero, false and text.** A cell is missing only when it is empty after
   trimming whitespace. `0`, `0.00`, `false` and `"not applicable"` are recorded
   values.

5. **Say what you cannot know.** If a check relies on a heuristic, an assumption or a
   statistical method with known weaknesses, that must appear in the finding and in
   the exported report.

## Where code goes

| Location | What belongs there |
| --- | --- |
| `src/lib/` | Pure logic. No React, no DOM access, no side effects. This is where checks live. |
| `src/lib/checks/` | One module per check family, each exporting a function that takes a table and returns `Finding[]`. |
| `src/lib/report/` | Report generation. Every dataset value must pass through `escapeHtml` or `escapeCsv`. |
| `src/components/` | Reusable interface pieces. |
| `src/pages/` | One module per navigation entry. |
| `src/test/` | Vitest suites. |

A check should be a pure function over a `ParsedTable`, which makes it testable
without rendering anything.

## Tests

Every check needs tests covering:

- the case where it finds nothing;
- the case where it finds something, with exact row numbers;
- at least one case where a naive implementation would produce a false positive;
- the severity it assigns and why.

If you fix a bug, add a test to `src/test/regression.test.ts` with a comment
explaining what the defect was. That file is the project's memory of its own
mistakes.

If you change a sample dataset, regenerate `docs/SAMPLE-FINDINGS.md`:

```bash
npx tsx scripts/gen-findings.ts > docs/SAMPLE-FINDINGS.md
```

and update `src/test/samples.test.ts` to match.

## Accessibility

The interface is meant to be usable with a keyboard and with a screen reader.

- Every interactive element is a real `<button>`, `<input>`, `<select>` or `<a>`.
- Form controls have labels. Tables have captions or accessible names.
- Status changes use `aria-live` where they are not otherwise announced.
- Colour is never the only way information is conveyed — severity always has a text
  label as well.
- Focus is always visible.

## Interface conventions

- Neutral palette, restrained accents. No decorative gradients, no animation that
  does not communicate something.
- Severity uses the shared `SeverityBadge`; the colour and the word always agree.
- Empty states explain what to do next rather than just saying "no data".
- Operations that take time show a loading state.
- Error messages say what went wrong, why, and what to try.

## Commit messages

Short imperative subject line, then a blank line, then why the change was made if it
is not obvious. Example:

```
Detect a mostly-numeric column with a few unreadable values

A single "n/a" was turning a whole column into text, so the invalid
values were never reported at all. Inference now tolerates up to 25%
unreadable values.
```

## Reporting a bug

Include the operating system and browser, the smallest CSV that reproduces the
problem, what you expected, and what happened. **Do not attach real or sensitive
datasets.** A synthetic file with the same shape is always enough.

For anything security-related, follow [`SECURITY.md`](SECURITY.md) instead of opening
a public issue.

## Scope

Out of scope, permanently: AI chat, automatic news writing, authentication, payments,
cloud accounts, social features, PDF extraction, image recognition, and any claim to
perform fact-checking. A pull request adding one of these will be closed, however
well written.

## Licence

By contributing you agree that your contribution is licensed under the MIT licence,
as described in [`LICENSE`](LICENSE).
