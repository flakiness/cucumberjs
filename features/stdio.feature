Feature: STDIO
  Scenario: captures Cucumber log output as attempt stdio
    Given a scenario report with Cucumber log output

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    Then the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 2 stdio entries

    When I look at the stdio entry #1
    Then the stdio entry has text "hello from log"

    When I look at the stdio entry #2
    Then the stdio entry has text "second line"
    And the stdio entry happened after the previous stdio entry
