# Reporter Features — cucumberjs

Status of [Flakiness Report Features](https://github.com/flakiness/flakiness-report/blob/main/features.md) as implemented by this
`@flakiness/cucumberjs` formatter.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Report metadata | ⚠️ | `commitId`, `flakinessProject`, `url`, `startTimestamp`, `duration` all populated. `url` auto-detected via `CIUtils.runUrl()`. `configPath` is not populated — CucumberJS does not expose its resolved config file to formatters. |
| 2 | Environment metadata | ✅ | `name` is hardcoded to `cucumberjs`; `osName`, `osVersion`, `osArch` populated by the SDK's `createEnvironment`. |
| 3 | Multiple environments | N/A | CucumberJS has no native concept of multiple projects/environments within a single run. A single `environments[]` entry is always emitted. |
| 4 | Custom environments (`FK_ENV_*`) | ✅ | Supported via the SDK's `createEnvironment`, which merges `FK_ENV_*` into `environment.metadata`. |
| 5 | Test hierarchy / suites | ✅ | Emits `file` → feature (`suite`) → optional rule (`suite`) → test. Gherkin has no anonymous-suite concept, so that case doesn't apply. |
| 6 | Per-attempt reporting (retries) | ✅ | CucumberJS emits a separate `testCaseStarted` / `testCaseFinished` pair per retry; each becomes its own `RunAttempt` with its own status, duration, errors, stdio, steps, and attachments. |
| 7 | Per-attempt timeout | ❌ | `RunAttempt.timeout` is not populated. CucumberJS does not surface the effective per-test timeout on its protocol messages. |
| 8 | Test steps | ✅ | Each Gherkin step (plus before/after hooks) is emitted as an `RunAttemptStep` with `title`, `duration`, `location`, and optional `error`. CucumberJS has no nested sub-step concept. |
| 9 | Expected status (`expectedStatus`) | N/A | CucumberJS has no native expected-to-fail mechanism. |
| 10 | Attachments | ✅ | `this.attach()` payloads (both text and binary via `AttachmentContentEncoding.BASE64`) are emitted via `ReportUtils.createDataAttachment` and referenced by ID. |
| 11 | Step-level attachments | ✅ | Attachments are attributed to the specific step that produced them (via CucumberJS's `parseTestCaseAttempt` grouping). |
| 12 | Timed StdIO | ✅ | `this.log()` output (media type `text/x.cucumber.log+plain`) is promoted to `TimedSTDIOEntry` with `dts` deltas. Both text and `buffer` variants supported. |
| 13 | Annotations | ✅ | Emits custom `feature` / `rule` / `scenario` annotations carrying the corresponding Gherkin `description` block and source location. Standard `skip` / `fixme` / `fail` / `slow` / `owner` types don't apply — CucumberJS has no matching concepts (skipped/pending map to test status instead). |
| 14 | Tags | ✅ | Tag inheritance (Feature → Rule → Scenario → Examples) is flattened by CucumberJS into `pickle.tags`; emitted on `test.tags` with the leading `@` stripped. |
| 15 | `parallelIndex` | ✅ | Populated from `testCaseStarted.workerId`. CucumberJS's opaque worker ID is remapped to a stable dense index per run. |
| 16 | `FLAKINESS_TITLE` | ✅ | Honored; also settable via the `title` formatter option. |
| 17 | `FLAKINESS_OUTPUT_DIR` | ✅ | Honored; also settable via the `outputFolder` formatter option. Defaults to `flakiness-report`. |
| 18 | Sources | ✅ | Top-level `sources[]` populated via the SDK's `collectSources`. |
| 19 | Error snippets | ✅ | `ReportError.snippet` is populated from CucumberJS's `snippet` (the suggested step-definition stub for `undefined` steps). CucumberJS does not produce ANSI-highlighted error excerpts, so none are emitted — the reporter forwards what the runner provides. |
| 20 | Errors support | ⚠️ | Multiple errors per attempt supported (one per failing step). `message`, `stack`, and step `location` are populated. `value` for non-`Error` throws is not captured, and error locations come from the step's source/action location rather than being parsed from stack frames. |
| 21 | Unattributed errors | ❌ | `report.unattributedErrors` is not populated. CucumberJS does not route setup/teardown-level failures to a non-test channel. |
| 22 | Source locations | ✅ | Populated on tests, suites (file / feature / rule), steps, errors, and annotations. |
| 23 | Auto-upload | ✅ | Supports GitHub OIDC (via `flakinessProject`), `FLAKINESS_ACCESS_TOKEN` (or `token` option), and `FLAKINESS_DISABLE_UPLOAD` (or `disableUpload` option) to opt out. |
| 24 | CPU / RAM telemetry | ✅ | Sampled every 1s via the SDK's `CPUUtilization` / `RAMUtilization`; `cpuAvg`, `cpuMax`, `ram`, `cpuCount`, `ramBytes` are enriched onto the report. |
