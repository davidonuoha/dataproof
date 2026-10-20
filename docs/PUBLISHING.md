# Publishing this repository on GitHub

The project is ready to publish as it stands. Nothing in the source tree contains
credentials, personal information or files belonging to another project.

## 1. Check what will be committed

```bash
cd dataproof
git status --short
```

`.gitignore` excludes `node_modules/`, `dist/`, `coverage/`, `test-results/`,
`playwright-report/`, environment files, editor noise and the `work/` scratch
directory.

Confirm nothing sensitive is staged:

```bash
git add -A
git status --short
# Search the staged content for anything that looks like a credential.
git diff --cached | grep -nEi '(api[_-]?key|secret|password|token|BEGIN [A-Z ]*PRIVATE KEY)' || echo "No credential-like strings found."
```

## 2. Initialise the repository

```bash
git init -b main
git add -A
git commit -m "DataProof 0.1.0 — data quality checks for journalists"
```

If the repository is to be published under an organisation rather than a personal
account, adjust the URL in the next step and in `package.json` if you add one.

## 3. Create the remote

Using the GitHub CLI:

```bash
gh auth login
gh repo create dataproof --public --source=. --remote=origin --push \
  --description "An open-source data quality tool for journalists. Inspect CSV datasets for missing values, duplicates, inconsistent categories, invalid dates, anomalies and changes between versions — entirely in the browser."
```

Or manually: create an empty repository on GitHub, then

```bash
git remote add origin https://github.com/<your-account>/dataproof.git
git push -u origin main
```

## 4. Configure the repository

**Topics** (Settings → General, or on the repository page):
`journalism`, `data-journalism`, `data-quality`, `csv`, `open-data`,
`data-validation`, `react`, `typescript`, `privacy`, `investigative-journalism`.

**Description:** the one-liner used above.

**Website:** the GitHub Pages URL if you enable it (step 6).

**Features:** Issues on, Discussions optional, Wiki off (the `docs/` folder is the
documentation), Projects optional.

## 5. Protect the main branch and enable CI

`.github/workflows/ci.yml` runs on every push and pull request: it type-checks, runs
the unit and component tests, builds the production bundle, and runs the Playwright
suite against the built output.

To require it before merging: Settings → Branches → Add branch protection rule for
`main`, enable **Require status checks to pass**, and select the CI job.

## 6. Optional: publish the built application

DataProof is static files, so GitHub Pages works. After `npm run build`, `dist/`
contains everything.

A minimal workflow:

```yaml
# .github/workflows/pages.yml
name: Deploy to Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then Settings → Pages → Source: **GitHub Actions**.

Note that `vite.config.ts` sets `base: './'`, so the bundle works from a subpath
without further configuration.

## 7. Create the first release

```bash
git tag -a v0.1.0 -m "DataProof 0.1.0"
git push origin v0.1.0
```

On GitHub, Draft a new release from the tag. Attach a built archive if you want people
to be able to run it without Node:

```bash
npm run build
cd dist && zip -r ../dataproof-0.1.0-dist.zip . && cd ..
```

Release notes should point at `docs/FEATURES.md` and `docs/LIMITATIONS.md`, and state
the scope explicitly — CSV only, no fact-checking, no backend.

## 8. Before you announce it

- [ ] `npm test` passes.
- [ ] `npm run build` succeeds.
- [ ] `npm run test:e2e` passes.
- [ ] The screenshots in `docs/screenshots/` match the current interface. Regenerate
      with `npx playwright test e2e/screenshots.spec.ts`.
- [ ] `README.md` still describes the application accurately.
- [ ] `docs/SAMPLE-FINDINGS.md` matches the current checks. Regenerate with
      `npx tsx scripts/gen-findings.ts > docs/SAMPLE-FINDINGS.md`.
- [ ] No real dataset, credential or personal detail appears anywhere in the tree.
- [ ] The licence is the one you intend, and `package.json` agrees with `LICENSE`.
- [ ] You have not written anything claiming adoption, endorsement, contributors or
      users that do not exist. Version 0.1.0 has none of these.

## 9. Where to share it

For a journalism-technology audience, the natural places are:

- **Source** (OpenNews) — a publication for people who build and use journalism
  technology. A short piece describing the problem, the design decisions and the
  limitations fits its remit.
- **NICAR / IRE** and regional data-journalism meetups.
- **The Open Data Institute** community, if the framing is about public data quality.
- Relevant GitHub topics, and any newsroom-tools lists that accept submissions.

Lead with the limitations, not the feature list. The most credible thing about a data
quality tool is a clear statement of what it cannot tell you.

## Maintenance notes

- Keep the finding text and the documentation in step. `docs/FEATURES.md` describes
  each check; `docs/SAMPLE-FINDINGS.md` is generated and should be regenerated whenever
  a check or a sample changes.
- Keep the dependency tree small. A new runtime dependency is code the user is asked to
  trust with their data.
- Keep the privacy guarantees. No network calls at runtime, no storage APIs, no
  analytics. See `docs/PRIVACY.md`.
- If a check is added, it needs a plain-language explanation, a stated method, a
  suggested next step and an uncertainty statement where relevant. This is not
  negotiable; see `CONTRIBUTING.md`.
