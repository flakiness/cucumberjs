import { Given } from '@cucumber/cucumber';
import type { TestWorld } from './harness.ts';
import { generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a scenario report with a data table', async function() {
  this.reportResult = await generateFlakinessReport('scenario with a data table', {
    'features/data-table.feature': `
      Feature: Data table

        Scenario: addition
          Given a table
            | a | b | result |
            | 2 | 2 | 4 |
            | 1 | 7 | 8 |
          When I add the values
          Then I get the expected results
    `,
    'features/support/steps.js': `
      const assert = require('node:assert/strict');
      const { Given, When, Then } = require('@cucumber/cucumber');

      Given('a table', function(dataTable) {
        this.rows = dataTable.hashes().map(row => ({
          a: Number(row.a),
          b: Number(row.b),
          result: Number(row.result),
        }));
      });

      When('I add the values', function() {
        this.results = this.rows.map(row => row.a + row.b);
      });

      Then('I get the expected results', function() {
        assert.deepEqual(this.results, this.rows.map(row => row.result));
      });
    `,
  });
});
