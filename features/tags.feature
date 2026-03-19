Feature: Tags
  Scenario: captures test tags
    Given the project file "features/tagged.feature":
      """
      @feature-tag
      Feature: Tagged
        @smoke @fast
        Scenario: it has tags
          Given a passing step
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      Given('a passing step', function() {});
      """
    And the environment variable "BUILD_URL" is "https://ci.example.test/build/123"
    When I generate the Flakiness report for "tagged scenario"

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    Then the test has tags "feature-tag, smoke, fast"
