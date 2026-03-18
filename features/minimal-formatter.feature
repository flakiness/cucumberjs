Feature: Minimal formatter
  Scenario: local formatter generates a basic report
    Given a sample Cucumber project with a passing scenario
    When I generate a Flakiness report with the local formatter
    Then the report should contain the basic metadata
