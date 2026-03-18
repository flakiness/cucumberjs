Feature: Minimal formatter
  Scenario: local formatter runs for a passing nested project
    Given a sample Cucumber project with a passing scenario
    When I run the sample project with the local formatter
    Then the formatter output should contain "[fk-cucumber] minimal formatter finished 1 scenario(s) [it passes]"
