import { Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TestWorld } from './harness.ts';
import { assertCount, generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a failing scenario report', async function() {
  this.reportResult = await generateFlakinessReport('failing scenario', {
    'features/failing.feature': `
      Feature: Failing
        Scenario: it fails
          Given a step that throws an error
    `,
    'features/support/steps.js': `
      const { Given } = require('@cucumber/cucumber');

      Given('a step that throws an error', function() {
        throw new Error('intentional failure');
      });
    `,
  }, {
    env: {
      BUILD_URL: 'https://ci.example.test/build/123',
    },
  });
});

Then<TestWorld>('the attempt contains {int} error', function(expectedErrors: number) {
  assertCount(this.attempt?.errors, expectedErrors);
});

Then<TestWorld>('the attempt error #{int} has message {string}', function(errorIdx: number, message: string) {
  assert.equal(this.attempt?.errors?.[errorIdx - 1]?.message, message);
});

Then<TestWorld>('the attempt error #{int} has a stack trace', function(errorIdx: number) {
  assert.ok(this.attempt?.errors?.[errorIdx - 1]?.stack, 'Expected error stack to be present');
});

Then<TestWorld>('the step has an error with message {string}', function(message: string) {
  assert.equal(this.step?.error?.message, message);
});
