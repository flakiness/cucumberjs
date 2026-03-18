Feature: Basic Functionality
  Scenario: generates a basic report
    Given a passing scenario report
    Then the report should contain the basic metadata

    When I look at the first suite
      Then the suite contains 1 test

  Scenario: captures a scenario that succeeds on retry
    Given a flaky scenario report

    When I look at the first suite
    Then the suite contains 1 test

    When I look at the first test
    Then the test contains 2 attempts
    And attempt #1 failed
    And attempt #2 passed
