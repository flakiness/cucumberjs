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
- [Features](#features)
  - [Environment Detection](#environment-detection)
  - [CI Integration](#ci-integration)
- [Configuration Options](#configuration-options)
  - [`flakinessProject?: string`](#flakinessproject-string)
  - [`endpoint?: string`](#endpoint-string)
  - [`token?: string`](#token-string)
  - [`outputFolder?: string`](#outputfolder-string)
  - [`disableUpload?: boolean`](#disableupload-boolean)
- [Example Configuration](#example-configuration)

## Requirements

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
  format: ['@flakiness/cucumberjs', 'progress'],
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

Reports are automatically uploaded to Flakiness.io after test completion. Authentication can be done in two ways:

- **Access token**: Provide a token via the `token` format option or the `FLAKINESS_ACCESS_TOKEN` environment variable.
- **GitHub OIDC**: When running in GitHub Actions, the formatter can authenticate using GitHub's OIDC token — no access token needed. See [GitHub Actions integration](https://docs.flakiness.io/ci/github-actions/) for setup instructions.

If upload fails, the report is still available locally in the output folder.

## Viewing Reports

After test execution, you can view the report using:

```bash
npx flakiness show ./flakiness-report
```

## Features

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

The Flakiness.io project identifier in `org/project` format. Used for GitHub OIDC authentication — when set, and the Flakiness.io project is bound to the GitHub repository running the workflow, the formatter authenticates uploads via GitHub Actions OIDC token with no access token required.

```javascript
formatOptions: {
  flakinessProject: 'my-org/my-project',
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

If no token is provided, the formatter will attempt to authenticate using GitHub OIDC.

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
  format: ['@flakiness/cucumberjs', 'progress'],
  formatOptions: {
    flakinessProject: 'my-org/my-project',
    endpoint: process.env.FLAKINESS_ENDPOINT,
    token: process.env.FLAKINESS_ACCESS_TOKEN,
    outputFolder: './flakiness-report',
    disableUpload: false,
  },
};
```
