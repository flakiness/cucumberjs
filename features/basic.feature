Feature: Basic Functionality
  Scenario: generates a basic report
    Given a passing scenario report
    Then the report should contain the basic metadata

    When I look at the suite #1
      Then the suite contains 0 tests
      And the suite is called "passing.feature"
      
      When I look at the suite #1
        Then the suite is called "Passing Test Suite"
        And the suite contains 1 test

        When I look at the test #1
        Then the test is called "it passes"

  Scenario: captures a scenario that succeeds on retry
    Given a flaky scenario report

    When I look at the suite #1
    Then the suite contains 0 tests

    When I look at the suite #1
    Then the suite contains 1 tests

    When I look at the test #1
    Then the test contains 2 attempts
    And attempt #1 failed
    And attempt #2 passed
