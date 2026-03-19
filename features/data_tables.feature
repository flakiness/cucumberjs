Feature: Data Tables
  Scenario: keeps step titles single-line for data tables
    Given a scenario report with a data table

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    Then the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 3 steps

    When I look at the step #1
    Then the step is called "a table"
