Feature: Steps
  Scenario: captures test steps
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
    When I generate the Flakiness report for "passing steps"

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    Then I look at the test #1
    And the test contains 1 attempt
    
    Then I look at the attempt #1
    And the attempt contains 1 step

    Then I look at the step #1
    Then the step is called "a passing step"
    And the step is in file "features/passing.feature" at line 3
