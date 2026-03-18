import { execFileSync, spawnSync } from 'node:child_process';
import { readReport } from '@flakiness/sdk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type SampleProjectFiles = Record<string, string>;

export type SampleProjectRun = {
  status: number,
  stdout: string,
  stderr: string,
  targetDir: string,
  reportDir: string,
};

export type SampleProjectOptions = {
  env?: Record<string, string | undefined>,
  formatOptions?: Record<string, unknown>,
};

export type GenerateFlakinessReportResult = Awaited<ReturnType<typeof readReport>> & {
  log: {
    stdout: string,
    stderr: string,
  },
  targetDir: string,
};

export const ARTIFACTS_DIR = process.platform === 'darwin'
  ? '/private/tmp/flakiness-cucumber'
  : path.join(os.tmpdir(), 'flakiness-cucumber');

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const CUCUMBER_BIN = path.join(PROJECT_ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');
const FORMATTER_PATH = path.join(PROJECT_ROOT, 'lib', 'formatter.js');
const NODE_MODULES_PATH = path.join(PROJECT_ROOT, 'node_modules');

const DEFAULT_FILES: SampleProjectFiles = {
  'package.json': JSON.stringify({
    name: 'sample-cucumber-project',
    version: '1.0.0',
  }, null, 2),
};

export function runSampleProject(name: string, files: SampleProjectFiles, options: SampleProjectOptions = {}): SampleProjectRun {
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
      '--format',
      FORMATTER_PATH,
      ...formatOptionsArgs(options.formatOptions),
    ],
    {
      cwd: targetDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...options.env,
        NODE_PATH: [NODE_MODULES_PATH, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
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
  files: SampleProjectFiles,
  options: SampleProjectOptions = {},
): Promise<GenerateFlakinessReportResult> {
  const run = runSampleProject(name, files, {
    env: options.env,
    formatOptions: {
      ...options.formatOptions,
      outputFolder: path.join(ARTIFACTS_DIR, slugify(name), 'flakiness-report'),
      disableUpload: true,
      open: 'never',
    },
  });

  return {
    ...(await readReport(run.reportDir)),
    log: {
      stdout: run.stdout,
      stderr: run.stderr,
    },
    targetDir: run.targetDir,
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
