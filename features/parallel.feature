Feature: Parallel indexes
  Scenario: captures parallel worker indexes
    Given the project file "features/parallel.feature":
      """
      Feature: Parallel execution
        Scenario: first scenario
          Given a slow passing step

        Scenario: second scenario
          Given a slow passing step

        Scenario: third scenario
          Given a slow passing step

        Scenario: flaky scenario
          Given a flaky slow step
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');

      let flakyAttempts = 0;

      Given('a slow passing step', async function() {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      Given('a flaky slow step', async function() {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (flakyAttempts++ === 0)
          throw new Error('fail once');
      });
      """
    And the Cucumber arguments are:
      | --parallel |
      | 2 |
      | --retry |
      | 1 |
    When I generate the Flakiness report for "parallel worker indexes"
    Then the report contains 4 tests
    And every attempt has a parallel index
    And the report contains 2 distinct parallel indexes
    And the report parallel indexes are in range 0 to 1
    When I look at the test named "flaky scenario"
    Then the test contains 2 attempts
    And attempt #1 and attempt #2 have the same parallel index
