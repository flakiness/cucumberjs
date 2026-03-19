import { Given } from '@cucumber/cucumber';
import type { TestWorld } from './harness.ts';
import { generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a scenario outline report', async function() {
  this.reportResult = await generateFlakinessReport('scenario outline', {
    'features/addition.feature': `
      Feature: Addition

        Scenario Outline: addition
          Given a calculator
          When I add <a> to <b>
          Then I get <result>

          Examples:
            | a | b | result |
            | 2 | 2 | 4 |
            | 1 | 7 | 8 |
    `,
    'features/support/steps.js': `
      const assert = require('node:assert/strict');
      const { Given, When, Then } = require('@cucumber/cucumber');

      Given('a calculator', function() {});

      When('I add {int} to {int}', function(a, b) {
        this.result = a + b;
      });

      Then('I get {int}', function(expected) {
        assert.equal(this.result, expected);
      });
    `,
  });
});
