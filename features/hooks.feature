Feature: Hooks
  Scenario: captures before and after hooks
    Given a scenario report with before and after hooks

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    And the test contains 1 attempt

    When I look at the attempt #1
    And the attempt contains 3 steps

    When I look at the step #1
    Then the step is called "Before"
    And the step is in file "features/support/steps.js" at line 3

    When I look at the step #2
    Then the step is called "a passing step"
    And the step is in file "features/passing.feature" at line 4

    When I look at the step #3
    Then the step is called "After"
    And the step is in file "features/support/steps.js" at line 4
