Feature: Named Hooks
  Scenario: captures named hooks
    Given the project file "features/passing.feature":
      """
      Feature: Hooks
        Scenario: it runs named hooks
          Given a passing step
      """
    And the project file "features/support/steps.js":
      """
      const { Before, After, Given } = require('@cucumber/cucumber');
      Before({ name: 'database setup' }, function() {});
      After({ name: 'database cleanup' }, function() {});
      Given('a passing step', function() {});
      """
    When I generate the Flakiness report for "scenario with named hooks"
    When I look at the test named "it runs named hooks"
    And the test contains 1 attempt
    When I look at the attempt #1
    And the attempt contains 3 steps

    When I look at the step #1
    Then the step is called "Before (database setup)"
    And the step is in file "features/support/steps.js" at line 2

    When I look at the step #2
    Then the step is called "Given a passing step"
    And the step is in file "features/passing.feature" at line 3

    When I look at the step #3
    Then the step is called "After (database cleanup)"
    And the step is in file "features/support/steps.js" at line 3
