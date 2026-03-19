Feature: Basic Functionality
  Scenario: generates a basic report
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
    And the environment variable "BUILD_URL" is "https://ci.example.test/build/123"
    When I generate the Flakiness report for "passing scenario"
    Then the report should contain the basic metadata
    And the report hierarchy is:
      """
      `- file passing.feature
         `- suite Passing Test Suite
            `- test it passes
               `- attempt #1 passed
                  `- step a passing step
      """

    When I look at the test named "it passes"
    Then the test is in file "features/passing.feature" at line 2
