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
    When I generate the Flakiness report for "failing scenario"
    When I look at the test named "it fails"
    Then the test contains 1 attempt
    When I look at the "failed" attempt
    # Make sure the attempt has error
    Then the attempt contains 1 error
    And the attempt error #1 has message "intentional failure"
    And the attempt error #1 has a stack trace

    # Make sure the same error exists in step too
    Then the attempt contains 1 step
    When I look at the step named "Given a step that throws an error"
    And the step has an error with message "intentional failure"
