# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately to the maintainers, for example through GitHub's
**Security → Report a vulnerability** form on the repository. Include:

- what the problem is and where it is in the code;
- the smallest file or input that reproduces it;
- the impact you believe it has;
- the browser and operating system you tested with.

You will get an acknowledgement, an assessment, and a note when a fix is released.
Please give the maintainers a reasonable window to ship a fix before disclosing
publicly.

## Threat model

DataProof is unusual in that it has no server. Understanding what that does and does
not protect against is useful when assessing a report.

### What the architecture rules out

- **No data exfiltration to a DataProof server.** There is no server. The built
  application is a folder of static files.
- **No stored credentials to steal.** There is no account system, no session token
  and no API key.
- **No stored dataset to leak.** Datasets live in JavaScript memory and are never
  written to disk, cookies, `localStorage` or IndexedDB.
- **No server-side injection surface.** There is nothing to inject into.

### What is in scope

- **Cross-site scripting through dataset values.** A CSV cell containing HTML must be
  rendered as text everywhere it appears — in the interface, in the exported HTML
  report and in any other output. `src/lib/html.ts` provides the escapers and every
  path that emits markup must use them. A bypass is a valid report.
- **Denial of service against the browser tab.** A crafted file that causes the tab to
  hang, crash or exhaust memory beyond the documented limits. The file-size cap and
  the caps on affected-row lists exist to bound this; bypasses are worth reporting.
- **Dependency vulnerabilities.** A known vulnerability in a direct dependency that is
  reachable from the application code. Please include the advisory identifier.
- **Unsafe evaluation.** Any path where a value from a file or from user input could
  reach `eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML` or a dynamic
  import. There is currently no such path; the cross-field comparison feature
  deliberately uses a structured builder rather than an expression parser.

### What is out of scope

- **The privacy of the file on the user's own machine.** DataProof cannot protect a
  dataset from other software on the computer, from a browser extension with
  permission to read page content, or from someone looking over a shoulder.
- **Exported reports that contain data.** If a user enables *include record values*,
  the exported file contains real data. That is a deliberate, warned-about choice.
  Handling the exported file securely is the user's responsibility.
- **Third-party hosting.** DataProof is static files. If it is served from a host that
  is compromised, that is a property of the host, not of this project.
- **Attacks that require the user to paste code into the developer console.**

## Supported versions

The project is at version 0.1.0 and has not yet had a stable release. Security fixes
are applied to the main branch. Once there are tagged releases, the most recent
release will be supported.

## Dependency policy

The project deliberately keeps its dependency tree small: React, React DOM and
PapaParse at runtime, plus the build and test toolchain. A new runtime dependency
needs a clear justification, because every one of them is code the user is asked to
trust with their data.

## What the application does with your data, in one paragraph

Files are read with the browser's File API and parsed in a Web Worker inside the tab.
Nothing is transmitted anywhere. Nothing is persisted. Findings, settings and the
parsed table exist in memory and disappear when the tab is closed or when **Clear
session** is pressed. Reports are assembled in memory and handed to the browser's
download mechanism. No analytics, no telemetry, no error reporting service, and no
logging of dataset values to the console.
