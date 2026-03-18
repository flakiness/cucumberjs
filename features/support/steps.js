import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BeforeAll, Given, Then, When } from '@cucumber/cucumber';
import { ARTIFACTS_DIR, runSampleProject } from './harness.js';

BeforeAll(function() {
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
});

Given('a sample Cucumber project with a passing scenario', function() {
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

When('I run the sample project with the local formatter', function() {
  this.run = runSampleProject(this.files);
});

Then('the formatter output should contain {string}', function(expected) {
  assert.equal(this.run.status, 0, `Expected nested Cucumber run to succeed.\n\nSTDOUT:\n${this.run.stdout}\n\nSTDERR:\n${this.run.stderr}`);
  assert.ok(this.run.stdout.includes(expected), `Expected output to contain:\n${expected}\n\nActual output:\n${this.run.stdout}`);
});
