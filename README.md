[![Tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fflakiness.io%2Fapi%2Fbadge%3Finput%3D%257B%2522badgeToken%2522%253A%2522badge-2XD99RoRXgOvFfVcxVMJ0l%2522%257D)](https://flakiness.io/flakiness/cucumberjs)

# Flakiness.io CucumberJS Formatter

A custom CucumberJS formatter that generates Flakiness Reports from your Cucumber test runs. The formatter automatically converts CucumberJS test results into the standardized [Flakiness JSON format](https://github.com/flakiness/flakiness-report), preserving complete Gherkin structure, test outcomes, and environment information.

## Supported Gherkin Features

- Scenarios & Scenario Outlines (with multiple Examples blocks)
- Rules
- Tags & tag inheritance (Feature → Rule → Scenario → Examples)
- Steps (Given/When/Then with keyword prefix)
- Data Tables
- Before & After Hooks (named and unnamed)
- Feature, Rule, and Scenario descriptions
- Attachments (`this.attach()` and `this.log()`)
- Retries (`--retry`)
- Parallel execution (`--parallel`)
- All statuses: passed, failed, pending, undefined, ambiguous, skipped

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Uploading Reports](#uploading-reports)
- [Viewing Reports](#viewing-reports)
- [Using With Other Formatters](#using-with-other-formatters)
- [Features](#features)
  - [Environment Detection](#environment-detection)
  - [CI Integration](#ci-integration)
- [Configuration Options](#configuration-options)
  - [`flakinessProject?: string`](#flakinessproject-string)
  - [`title?: string`](#title-string)
  - [`endpoint?: string`](#endpoint-string)
  - [`token?: string`](#token-string)
  - [`outputFolder?: string`](#outputfolder-string)
  - [`disableUpload?: boolean`](#disableupload-boolean)
- [Example Configuration](#example-configuration)

## Requirements

- Node.js 20.17.0 or higher (22.9.0 or higher on Node 22)
- `@cucumber/cucumber` 12.0 or higher
- Node.js project with a git repository (for commit information)

## Installation

```bash
npm install -D @flakiness/cucumberjs
```

## Quick Start

Add the formatter to your `cucumber.mjs`:

```javascript
export default {
  paths: ['features/**/*.feature'],
  import: ['features/support/**/*.ts'],
  format: ['@flakiness/cucumberjs'],
  formatOptions: {
    flakinessProject: 'my-org/my-project',
  },
};
```

Run your tests. The report will be automatically generated in the `./flakiness-report` folder:

```bash
npx cucumber-js
```

View the interactive report:

```bash
npx flakiness show ./flakiness-report
```

## Uploading Reports

Reports are automatically uploaded to Flakiness.io after test completion. Authentication is resolved in the following order, and the first available method wins:

- **Access token**: Provide a token via the `token` format option or the `FLAKINESS_ACCESS_TOKEN` environment variable.
- **GitHub OIDC**: When running in GitHub Actions with no access token, the formatter can authenticate using GitHub's OIDC token. This requires the `flakinessProject` format option to be set, the Flakiness.io project to be bound to the GitHub repository running the workflow, and the workflow to grant the `id-token: write` permission. See [GitHub Actions integration](https://docs.flakiness.io/ci/github-actions/) for setup instructions.
- **GitLab OIDC**: When running in GitLab CI/CD with no access token, the formatter can authenticate using a GitLab ID token. GitLab mints ID tokens when the job starts, so the job must declare one named `FLAKINESS_ID_TOKEN` whose audience is your project identifier:

  ```yaml
  test:
    id_tokens:
      FLAKINESS_ID_TOKEN:
        aud: my-org/my-project   # must match the `flakinessProject` format option
    script:
      - npx cucumber-js
  ```

  The `flakinessProject` format option must be set, and the Flakiness.io project must be bound to the GitLab project running the pipeline.

If no method is available the upload is skipped, and if an upload fails the report is still available locally in the output folder. Either way the test run is unaffected.

## Viewing Reports

After test execution, you can view the report using:

```bash
npx flakiness show ./flakiness-report
```

## Using With Other Formatters

With the default configuration (`format: ['@flakiness/cucumberjs']`), `@flakiness/cucumberjs` runs as the sole formatter and does not emit per-step progress to `stdout`. If you prefer the live progress output from CucumberJS's built-in `progress` formatter during test runs, pair it with `@flakiness/cucumberjs`:

```javascript
export default {
  // ...
  format: [
    'progress',
    ['@flakiness/cucumberjs', 'flakiness.log'],
  ],
};
```

Then add `flakiness.log` to your `.gitignore`. CucumberJS only allows a single formatter to write to `stdout`, so when a second formatter is added CucumberJS requires a file path for one of them. `@flakiness/cucumberjs` itself never writes to this file — the report goes to `./flakiness-report` and status messages go to `stderr` — so the log stays empty and exists only to satisfy CucumberJS.

## Features

See [features.md](./features.md) for this formatter's status against the [Flakiness Report spec](https://github.com/flakiness/flakiness-report/blob/main/features.md).

### Environment Detection

Environment variables prefixed with `FK_ENV_` are automatically included in the environment metadata. The prefix is stripped and the key is converted to lowercase.

**Example:**

```bash
export FK_ENV_DEPLOYMENT=staging
export FK_ENV_REGION=us-east-1
```

This will result in the environment containing:
```json
{
  "metadata": {
    "deployment": "staging",
    "region": "us-east-1"
  }
}
```

Flakiness.io will create a dedicated history for tests executed in each unique environment. This means tests run with `FK_ENV_DEPLOYMENT=staging` will have a separate timeline from tests run with `FK_ENV_DEPLOYMENT=production`, allowing you to track flakiness patterns specific to each deployment environment.

### CI Integration

The formatter automatically detects CI environments and includes:
- CI run URLs (GitHub Actions, Azure DevOps, Jenkins, GitLab CI)
- Git commit information
- System environment data

## Configuration Options

All options are passed via CucumberJS's `formatOptions` in your configuration file.

### `flakinessProject?: string`

The Flakiness.io project identifier in `org/project` format. Required for CI OIDC authentication. When set, and when the Flakiness.io project is bound to the repository running the pipeline, the formatter authenticates uploads via a GitHub Actions or GitLab CI/CD OIDC token with no access token required. See [Uploading Reports](#uploading-reports) for the per-provider requirements.

```javascript
formatOptions: {
  flakinessProject: 'my-org/my-project',
}
```

### `title?: string`

Optional human-readable report title. Typically used to name a CI run, matrix shard, or other execution group.

Defaults to the `FLAKINESS_TITLE` environment variable, or empty otherwise.

```javascript
formatOptions: {
  title: 'Shard 1/4 — Linux Chrome',
}
```

### `endpoint?: string`

Custom Flakiness.io endpoint URL for uploading reports. Defaults to the `FLAKINESS_ENDPOINT` environment variable, or `https://flakiness.io` if not set.

Use this option to point to a custom or self-hosted Flakiness.io instance.

```javascript
formatOptions: {
  endpoint: 'https://custom.flakiness.io',
}
```

### `token?: string`

Access token for authenticating with Flakiness.io when uploading reports. Defaults to the `FLAKINESS_ACCESS_TOKEN` environment variable.

If no token is provided, the formatter falls back to CI OIDC on GitHub Actions and GitLab CI/CD.

```javascript
formatOptions: {
  token: 'your-access-token',
}
```

### `outputFolder?: string`

Directory path where the Flakiness report will be written. Defaults to `flakiness-report` in the current working directory, or the `FLAKINESS_OUTPUT_DIR` environment variable if set.

```javascript
formatOptions: {
  outputFolder: './test-results/flakiness',
}
```

### `disableUpload?: boolean`

When set to `true`, prevents uploading the report to Flakiness.io. The report is still generated locally. Can also be controlled via the `FLAKINESS_DISABLE_UPLOAD` environment variable.

```javascript
formatOptions: {
  disableUpload: true,
}
```

## Example Configuration

Here's a complete example with all options:

```javascript
export default {
  paths: ['features/**/*.feature'],
  import: ['features/support/**/*.ts'],
  format: [
    'progress',
    ['@flakiness/cucumberjs', 'flakiness.log'],
  ],
  formatOptions: {
    flakinessProject: 'my-org/my-project',
    title: 'My Test Run',
    endpoint: process.env.FLAKINESS_ENDPOINT,
    token: process.env.FLAKINESS_ACCESS_TOKEN,
    outputFolder: './flakiness-report',
    disableUpload: false,
  },
};
```
