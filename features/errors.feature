Feature: Errors
  Scenario: captures thrown errors
    Given a failing scenario report

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
