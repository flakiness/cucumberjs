import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ARTIFACTS_DIR = process.platform === 'darwin'
  ? '/private/tmp/flakiness-cucumber'
  : path.join(os.tmpdir(), 'flakiness-cucumber');

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const CUCUMBER_BIN = path.join(PROJECT_ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');
const FORMATTER_PATH = path.join(PROJECT_ROOT, 'lib', 'formatter.js');
const NODE_MODULES_PATH = path.join(PROJECT_ROOT, 'node_modules');

const DEFAULT_FILES = {
  'package.json': JSON.stringify({
    name: 'sample-cucumber-project',
    version: '1.0.0',
    type: 'module',
  }, null, 2),
};

export function runSampleProject(files) {
  const targetDir = path.join(ARTIFACTS_DIR, crypto.randomUUID());
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.symlinkSync(NODE_MODULES_PATH, path.join(targetDir, 'node_modules'), 'dir');

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
      '--import',
      'features/support/**/*.js',
      '--format',
      FORMATTER_PATH,
    ],
    {
      cwd: targetDir,
      encoding: 'utf8',
      env: {
        ...process.env,
      },
    },
  );

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    targetDir,
  };
}

function initGitRepo(targetDir) {
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
