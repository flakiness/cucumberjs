import type { IWorld } from '@cucumber/cucumber';
import type { FlakinessReport as FK } from '@flakiness/flakiness-report';
import { readReport } from '@flakiness/sdk';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export type TestWorld = IWorld & {
  reportResult?: GenerateFlakinessReportResult,
  projectArgs?: string[],
  projectEnv?: Record<string, string | undefined>,
  projectFiles?: ProjectFiles,
  suite?: FK.Suite,
  test?: FK.Test,
  attempt?: FK.RunAttempt,
  attachment?: FK.Attachment,
  step?: FK.TestStep,
  stdio?: FK.TimedSTDIOEntry,
};

export type ProjectFiles = Record<string, string>;

export type SampleProjectRun = {
  status: number,
  stdout: string,
  stderr: string,
  targetDir: string,
  reportDir: string,
};

export type ProjectRunOptions = {
  args?: string[],
  env?: Record<string, string | undefined>,
  formatOptions?: Record<string, unknown>,
};

export type GenerateFlakinessReportResult = Awaited<ReturnType<typeof readReport>> & {
  log: {
    stdout: string,
    stderr: string,
  },
};

export const ARTIFACTS_DIR = process.platform === 'darwin'
  ? '/private/tmp/flakiness-cucumber'
  : path.join(os.tmpdir(), 'flakiness-cucumber');

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const CUCUMBER_BIN = path.join(PROJECT_ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');
const FORMATTER_PATH = path.join(PROJECT_ROOT, 'lib', 'formatter.js');
const NODE_MODULES_PATH = path.join(PROJECT_ROOT, 'node_modules');

const CLEARED_CI_ENV: Record<string, undefined> = {
  BUILD_BUILDID: undefined,
  BUILD_URL: undefined,
  CI_JOB_URL: undefined,
  GITHUB_REPOSITORY: undefined,
  GITHUB_RUN_ATTEMPT: undefined,
  GITHUB_RUN_ID: undefined,
  GITHUB_SERVER_URL: undefined,
  SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: undefined,
  SYSTEM_TEAMPROJECT: undefined,
};

const DEFAULT_FILES: ProjectFiles = {
  'package.json': JSON.stringify({
    name: 'sample-cucumber-project',
    version: '1.0.0',
  }, null, 2),
};

function runSampleProject(name: string, files: ProjectFiles, options: ProjectRunOptions = {}): SampleProjectRun {
  const targetDir = path.join(ARTIFACTS_DIR, slugify(name));
  const reportDir = path.join(targetDir, 'flakiness-report');
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const [filePath, content] of Object.entries({ ...DEFAULT_FILES, ...files })) {
    const fullPath = path.join(targetDir, ...filePath.split('/'));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  initGitRepo(targetDir);

  const result = spawnSync(
    process.execPath,
    [
      CUCUMBER_BIN,
      'features/**/*.feature',
      '--require',
      'features/support/**/*.js',
      ...(options.args ?? []),
      '--format',
      FORMATTER_PATH,
      ...formatOptionsArgs(options.formatOptions),
    ],
    {
      cwd: targetDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...CLEARED_CI_ENV,
        NODE_PATH: [NODE_MODULES_PATH, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
        ...options.env,
      },
    },
  );

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    targetDir,
    reportDir,
  };
}

export async function generateFlakinessReport(
  name: string,
  files: ProjectFiles,
  options: ProjectRunOptions = {},
): Promise<GenerateFlakinessReportResult> {
  const run = runSampleProject(name, files, {
    args: options.args,
    env: options.env,
    formatOptions: {
      ...options.formatOptions,
      outputFolder: path.join(ARTIFACTS_DIR, slugify(name), 'flakiness-report'),
      disableUpload: true,
      open: 'never',
    },
  });
  await waitForReport(run);

  return {
    ...(await readReport(run.reportDir)),
    log: {
      stdout: run.stdout,
      stderr: run.stderr,
    },
  };
}

function initGitRepo(targetDir: string): void {
  execFileSync('git', ['init'], { cwd: targetDir, stdio: 'pipe' });
  execFileSync('git', ['add', '.'], { cwd: targetDir, stdio: 'pipe' });
  execFileSync(
    'git',
    ['-c', 'user.email=john@example.com', '-c', 'user.name=john', '-c', 'commit.gpgsign=false', 'commit', '-m', 'staging'],
    {
      cwd: targetDir,
      stdio: 'pipe',
    },
  );
}

function slugify(value: string): string {
  return value
    .replace(/[^.a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function formatOptionsArgs(formatOptions: Record<string, unknown> | undefined): string[] {
  if (!formatOptions || !Object.keys(formatOptions).length)
    return [];
  return ['--format-options', JSON.stringify(formatOptions)];
}

export function assertCount<T>(elements: T[] | undefined, count: number): T[] {
  assert.equal(elements?.length ?? 0, count);
  return elements!;
}

async function waitForReport(run: SampleProjectRun): Promise<void> {
  const reportPath = path.join(run.reportDir, 'report.json');
  for (let attempt = 0; attempt < 50; ++attempt) {
    if (fs.existsSync(reportPath))
      return;
    await delay(20);
  }

  throw new Error([
    `Report not found at ${reportPath}`,
    `Exit status: ${run.status}`,
    `STDOUT:\n${run.stdout}`,
    `STDERR:\n${run.stderr}`,
  ].join('\n\n'));
}
