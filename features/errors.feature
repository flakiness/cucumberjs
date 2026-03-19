Feature: Errors
  Scenario: captures thrown errors
    Given the project file "features/failing.feature":
      """
      Feature: Failing
        Scenario: it fails
          Given a step that throws an error
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      Given('a step that throws an error', function() {
        throw new Error('intentional failure');
      });
      """
    And the environment variable "BUILD_URL" is "https://ci.example.test/build/123"
    When I generate the Flakiness report for "failing scenario"

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    Then the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 1 error
    And the attempt error #1 has message "intentional failure"
    And the attempt error #1 has a stack trace

    When the attempt contains 1 step
    Then I look at the step #1
    And the step has an error with message "intentional failure"
