Feature: Minimal formatter
  Scenario: local formatter generates a basic report
    Given a sample Cucumber project with a passing scenario
    Given I generate a Flakiness report with the local formatter
    Then the report should contain the basic metadata

    When I look at the first suite
      Then the suite contains 1 test
