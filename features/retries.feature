Feature: Retries
  Scenario: captures a scenario that succeeds on retry
    Given the project file "features/eventually-passing.feature":
      """
      Feature: Eventually passing
        Scenario: it succeeds on retry
          Given a step that succeeds on retry
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      let hasFailedOnce = false;

      Given('a step that succeeds on retry', function() {
        if (hasFailedOnce)
          return;
        hasFailedOnce = true;
        throw new Error('intentional first-attempt failure');
      });
      """
    And the Cucumber arguments are:
      | --retry |
      | 1 |
    When I generate the Flakiness report for "flaky scenario"
    When I look at the test named "it succeeds on retry"
    Then the test contains 2 attempts
    When I look at the "failed" attempt
    Then the attempt contains 1 step
    When I look at the "passed" attempt
    Then the attempt contains 1 step
