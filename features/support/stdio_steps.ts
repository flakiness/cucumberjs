import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TestWorld } from './harness.ts';
import { assertCount, generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a scenario report with Cucumber log output', async function() {
  this.reportResult = await generateFlakinessReport('scenario with cucumber log output', {
    'features/logging.feature': `
      Feature: Logging
        Scenario: it logs
          Given a logging step
    `,
    'features/support/steps.js': `
      const { Given } = require('@cucumber/cucumber');

      Given('a logging step', async function() {
        this.log('hello from log');
        await new Promise(resolve => setTimeout(resolve, 30));
        this.log('second line');
      });
    `,
  });
});

When<TestWorld>('I look at the stdio entry #{int}', function(entryIdx: number) {
  this.stdio = this.attempt?.stdio?.[entryIdx - 1];
});

Then<TestWorld>('the attempt contains {int} stdio entries', function(expectedEntries: number) {
  assertCount(this.attempt?.stdio, expectedEntries);
});

Then<TestWorld>('the stdio entry has text {string}', function(expectedText: string) {
  assert.ok(this.stdio && 'text' in this.stdio, 'Expected a text stdio entry');
  assert.equal(this.stdio.text, expectedText);
});

Then<TestWorld>('the stdio entry happened after the previous stdio entry', function() {
  assert.ok((this.stdio?.dts ?? 0) > 0, 'Expected stdio entry delta to be positive');
});
