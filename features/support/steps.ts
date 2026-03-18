import type { IWorld } from '@cucumber/cucumber';
import { BeforeAll, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ARTIFACTS_DIR, generateFlakinessReport } from './harness.ts';
import type { GenerateFlakinessReportResult, SampleProjectFiles } from './harness.ts';

type TestWorld = IWorld & {
  files?: SampleProjectFiles,
  reportResult?: GenerateFlakinessReportResult,
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
      const { Given } = require('@cucumber/cucumber');

      Given('a passing step', function() {});
    `,
  };
});

When<TestWorld>('I generate a Flakiness report with the local formatter', async function() {
  assert.ok(this.files, 'Expected sample files to be defined');
  this.reportResult = await generateFlakinessReport('minimal-formatter', this.files, {
    env: {
      BUILD_URL: 'https://ci.example.test/build/123',
    },
  });
});

Then<TestWorld>('the report should contain the basic metadata', function() {
  assert.ok(this.reportResult, 'Expected report result to be defined');
  const { report, log, targetDir } = this.reportResult;

  assert.equal(report.category, 'cucumberjs');
  assert.equal(report.url, 'https://ci.example.test/build/123');
  assert.equal(report.environments.length, 1);
  assert.equal(report.environments[0]?.name, 'cucumberjs');
  assert.ok(report.commitId, 'Expected commitId to be present');
  assert.ok(report.startTimestamp > 0, 'Expected startTimestamp to be present');
  assert.ok(report.duration > 0, 'Expected duration to be positive');
  assert.equal(report.tests, undefined);
  assert.equal(report.suites, undefined);
  assert.deepEqual(report.sources, []);

  assert.ok((report.cpuCount ?? 0) > 0, 'Expected cpuCount to be populated');
  assert.ok((report.cpuAvg?.length ?? 0) > 0, 'Expected cpuAvg telemetry to be populated');
  assert.ok((report.cpuMax?.length ?? 0) > 0, 'Expected cpuMax telemetry to be populated');
  assert.ok((report.ramBytes ?? 0) > 0, 'Expected ramBytes to be populated');
  assert.ok((report.ram?.length ?? 0) > 0, 'Expected ram telemetry to be populated');

  assert.equal(log.stderr, '', `Expected stderr to be empty.\n\nSTDERR:\n${log.stderr}`);
  assert.ok(log.stdout.includes('npx flakiness show'), `Expected report hint in stdout.\n\nSTDOUT:\n${log.stdout}`);
  assert.ok(targetDir.includes('minimal-formatter'), `Expected deterministic targetDir.\n\nTarget dir: ${targetDir}`);
});
