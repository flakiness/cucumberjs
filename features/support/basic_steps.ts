import { BeforeAll, Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { TestWorld } from './harness.ts';
import { ARTIFACTS_DIR, assertCount, generateFlakinessReport } from './harness.ts';

BeforeAll(function() {
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
});

Given<TestWorld>('a passing scenario report', async function() {
  this.reportResult = await generateFlakinessReport('passing scenario', {
    'features/passing.feature': `
      Feature: Passing Test Suite
        Scenario: it passes
          Given a passing step
    `,
    'features/support/steps.js': `
      const { Given } = require('@cucumber/cucumber');

      Given('a passing step', function() {});
    `,
  }, {
    env: {
      BUILD_URL: 'https://ci.example.test/build/123',
    },
  });
});

Given<TestWorld>('a flaky scenario report', async function() {
  this.reportResult = await generateFlakinessReport('flaky scenario', {
    'features/eventually-passing.feature': `
      Feature: Eventually passing
        Scenario: it succeeds on retry
          Given a step that succeeds on retry
    `,
    'features/support/steps.js': `
      const { Given } = require('@cucumber/cucumber');
      let hasFailedOnce = false;

      Given('a step that succeeds on retry', function() {
        if (hasFailedOnce)
          return;
        hasFailedOnce = true;
        throw new Error('intentional first-attempt failure');
      });
    `,
  }, {
    args: ['--retry', '1'],
  });
});

Then<TestWorld>('print', function() {
  console.log(this.reportResult?.report)
});

Then<TestWorld>('the report should contain the basic metadata', function() {
  assert.ok(this.reportResult, 'Expected report result to be defined');
  const { report, log } = this.reportResult;

  assert.equal(report.category, 'cucumberjs');
  assert.equal(report.url, 'https://ci.example.test/build/123');
  assert.equal(report.environments.length, 1);
  assert.equal(report.environments[0]?.name, 'cucumberjs');
  assert.ok(report.commitId, 'Expected commitId to be present');
  assert.ok(report.startTimestamp > 0, 'Expected startTimestamp to be present');
  assert.ok(report.duration > 0, 'Expected duration to be positive');

  assert.ok((report.cpuCount ?? 0) > 0, 'Expected cpuCount to be populated');
  assert.ok((report.cpuAvg?.length ?? 0) > 0, 'Expected cpuAvg telemetry to be populated');
  assert.ok((report.cpuMax?.length ?? 0) > 0, 'Expected cpuMax telemetry to be populated');
  assert.ok((report.ramBytes ?? 0) > 0, 'Expected ramBytes to be populated');
  assert.ok((report.ram?.length ?? 0) > 0, 'Expected ram telemetry to be populated');

  assert.equal(log.stderr, '', `Expected stderr to be empty.\n\nSTDERR:\n${log.stderr}`);
  assert.ok(log.stdout.includes('npx flakiness show'), `Expected report hint in stdout.\n\nSTDOUT:\n${log.stdout}`);
});

When<TestWorld>('I look at the suite #{int}', function(suiteIdx) {
  this.suite = (this.suite ?? this.reportResult?.report)?.suites?.[suiteIdx - 1];
});

When<TestWorld>('I look at the test #{int}', function(testIdx) {
  this.test = this.suite?.tests?.[testIdx - 1];
});

When<TestWorld>('I look at the attempt #{int}', function(attemptIdx) {
  this.attempt = this.test?.attempts[attemptIdx - 1]
});

When<TestWorld>('I look at the step #{int}', function(stepIdx) {
  this.step = this.attempt?.steps?.[stepIdx - 1];
});

Then<TestWorld>('the suite contains {int} test(s)', function(expectedTests: number) {
  assertCount(this.suite?.tests, expectedTests);
});

Then<TestWorld>('the test contains {int} attempt(s)', function(expectedAttempts: number) {
  assertCount(this.test?.attempts, expectedAttempts);
});

Then<TestWorld>('the attempt contains {int} step(s)', function(epxectedSteps: number) {
  assertCount(this.attempt?.steps, epxectedSteps);
});

Then<TestWorld>('the step contains {int} steps(s)', function(expectedSteps: number) {
  assertCount(this.step?.steps, expectedSteps);
});

Then<TestWorld>('attempt #{int} is {string}', function(attemptIdx, status) {
  assert.equal(this.test?.attempts[attemptIdx - 1]?.status ?? 'passed', status);
});

Then<TestWorld>('the suite is called {string}', function(title) {
  assert.equal(this.suite?.title, title);
});

Then<TestWorld>('the test is called {string}', function(title) {
  assert.equal(this.test?.title, title);
});

Then<TestWorld>('the step is called {string}', function(title) {
  assert.equal(this.step?.title, title);
});
