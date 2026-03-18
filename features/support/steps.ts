import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { IWorld } from '@cucumber/cucumber';
import { BeforeAll, Given, Then, When } from '@cucumber/cucumber';
import { ARTIFACTS_DIR, runSampleProject } from './harness.ts';
import type { SampleProjectFiles, SampleProjectRun } from './harness.ts';

type TestWorld = IWorld & {
  files?: SampleProjectFiles,
  run?: SampleProjectRun,
};

BeforeAll(function() {
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
});

Given<TestWorld>('a sample Cucumber project with a passing scenario', function() {
  this.files = {
    'features/passing.feature': `
      Feature: Passing
        Scenario: it passes
          Given a passing step
    `,
    'features/support/steps.js': `
      import { Given } from '@cucumber/cucumber';

      Given('a passing step', function() {});
    `,
  };
});

When<TestWorld>('I run the sample project with the local formatter', function() {
  assert.ok(this.files, 'Expected sample files to be defined');
  this.run = runSampleProject(this.files);
});

Then<TestWorld>('the formatter output should contain {string}', function(expected: string) {
  assert.ok(this.run, 'Expected sample run result to be defined');
  assert.equal(this.run.status, 0, `Expected nested Cucumber run to succeed.\n\nSTDOUT:\n${this.run.stdout}\n\nSTDERR:\n${this.run.stderr}`);
  assert.ok(this.run.stdout.includes(expected), `Expected output to contain:\n${expected}\n\nActual output:\n${this.run.stdout}`);
});
