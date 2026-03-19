Feature: Data Tables
  Scenario: keeps step titles single-line for data tables
    Given the project file "features/data-table.feature":
      """
      Feature: Data table

        Scenario: addition
          Given a table
            | a | b | result |
            | 2 | 2 | 4 |
            | 1 | 7 | 8 |
          When I add the values
          Then I get the expected results
      """
    And the project file "features/support/steps.js":
      """
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
      """
    When I generate the Flakiness report for "scenario with a data table"
    When I look at the test named "addition"
    Then the test contains 1 attempt
    When I look at the attempt #1
    Then the attempt contains 3 steps:
      """
      a table
      I add the values
      I get the expected results
      """
