Feature: Unnamed Hooks
  Scenario: captures before and after hooks
    Given the project file "features/passing.feature":
      """
      Feature: Hooks
        Scenario: it runs hooks
          Given a passing step
      """
    And the project file "features/support/steps.js":
      """
      const { Before, After, Given } = require('@cucumber/cucumber');
      Before(function() {});
      After(function() {});
      Given('a passing step', function() {});
      """
    And the environment variable "BUILD_URL" is "https://ci.example.test/build/123"
    When I generate the Flakiness report for "scenario with hooks"
    When I look at the test named "it runs hooks"
    And the test contains 1 attempt
    When I look at the attempt #1
    And the attempt contains 3 steps

    When I look at the step #1
    Then the step is called "Before"
    And the step is in file "features/support/steps.js" at line 2

    When I look at the step #2
    Then the step is called "Given a passing step"
    And the step is in file "features/passing.feature" at line 3

    When I look at the step #3
    Then the step is called "After"
    And the step is in file "features/support/steps.js" at line 3
