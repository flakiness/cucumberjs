Feature: Locations
  Scenario: computes locations relative to the git root
    Given the project file "features/orders/nested/checkout.feature":
      """
      Feature: Nested checkout

        Scenario: computes locations from git root
          Given a passing step
      """
    And the project file "features/support/nested/steps.js":
      """
      const { Before, Given } = require('@cucumber/cucumber');

      Before(function() {});
      Given('a passing step', function() {});
      """
    When I generate the Flakiness report for "nested locations"
    When I look at the suite named "checkout.feature"
    Then the suite is in file "features/orders/nested/checkout.feature" at line 0
    When I look at the suite named "Nested checkout"
    Then the suite is in file "features/orders/nested/checkout.feature" at line 1
    When I look at the test named "computes locations from git root"
    Then the test is in file "features/orders/nested/checkout.feature" at line 3
    And the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 2 steps:
      """
      Before
      Given a passing step
      """

    When I look at the step #1
    Then the step is in file "features/support/nested/steps.js" at line 3

    When I look at the step #2
    Then the step is in file "features/orders/nested/checkout.feature" at line 4
