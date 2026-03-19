Feature: Basic Functionality
  Scenario: generates a basic report
    Given the project file "features/passing.feature":
      """
      Feature: Passing Test Suite
        Scenario: it passes
          Given a passing step
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      Given('a passing step', function() {});
      """
    And the environment variable "BUILD_URL" is "https://ci.example.test/build/123"
    When I generate the Flakiness report for "passing scenario"
    Then the report should contain the basic metadata

    When I look at the suite #1
    Then the suite contains 0 tests
    And the suite is called "passing.feature"

    When I look at the suite #1
    Then the suite is called "Passing Test Suite"
    And the suite contains 1 test

    When I look at the test #1
    Then the test is called "it passes"
    And the test is in file "features/passing.feature" at line 2

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

    When I look at the suite #1
    Then the suite contains 0 tests

    When I look at the suite #1
    Then the suite contains 1 tests

    When I look at the test #1
    Then the test contains 2 attempts
    And attempt #1 is "failed"
    And attempt #2 is "passed"
