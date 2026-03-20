Feature: Statuses

  Scenario: captures non-passing Cucumber statuses
    Given the project file "features/statuses.feature":
      """
      Feature: Statuses

        Scenario: it is pending
          Given a pending step

        Scenario: it is ambiguous
          Given an ambiguous step

        Scenario: it is undefined
          Given an undefined step
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');

      Given('a pending step', function() {
        return 'pending';
      });

      Given('an ambiguous step', function() {});
      Given('an ambiguous step', function() {});
      """
    When I generate the Flakiness report for "cucumber statuses"
    Then the report contains 3 tests

    When I look at the test named "it is pending"
    Then the test contains 1 attempt
    And attempt #1 is "failed"
    When I look at the "failed" attempt
    Then the attempt contains 1 error
    And the attempt error #1 has message "Step is pending"
    And the attempt contains 1 step:
      """
      a pending step
      """
    When I look at the step #1
    Then the step has an error with message "Step is pending"

    When I look at the test named "it is ambiguous"
    Then the test contains 1 attempt
    And attempt #1 is "failed"
    When I look at the "failed" attempt
    Then the attempt contains 1 error
    And the attempt error #1 has message containing "Multiple step definitions match:"
    And the attempt contains 1 step:
      """
      an ambiguous step
      """
    When I look at the step #1
    Then the step has an error with message containing "Multiple step definitions match:"

    When I look at the test named "it is undefined"
    Then the test contains 1 attempt
    And attempt #1 is "failed"
    When I look at the "failed" attempt
    Then the attempt contains 1 error
    And the attempt error #1 has message "Undefined step"
    And the attempt error #1 has a snippet containing "an undefined step"
    And the attempt contains 1 step:
      """
      an undefined step
      """
    When I look at the step #1
    Then the step has an error with message "Undefined step"
    And the step error has a snippet containing "an undefined step"
