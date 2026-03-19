Feature: Scenario Outlines
  Scenario: captures one reported test per example row
    Given the project file "features/addition.feature":
      """
      Feature: Addition

        Scenario Outline: addition
          Given a calculator
          When I add <a> to <b>
          Then I get <result>

          Examples:
            | a | b | result |
            | 2 | 2 | 4 |
            | 1 | 7 | 8 |
      """
    And the project file "features/support/steps.js":
      """
      const assert = require('node:assert/strict');
      const { Given, When, Then } = require('@cucumber/cucumber');

      Given('a calculator', function() {});

      When('I add {int} to {int}', function(a, b) {
        this.result = a + b;
      });

      Then('I get {int}', function(expected) {
        assert.equal(this.result, expected);
      });
      """
    When I generate the Flakiness report for "scenario outline"

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 2 tests

    When I look at the test #1
    Then the test is called "addition [a=2, b=2, result=4]"
    And the test is in file "features/addition.feature" at line 10
    And the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 3 steps

    When I look at the step #2
    Then the step is called "I add 2 to 2"

    When I look at the test #2
    Then the test is called "addition [a=1, b=7, result=8]"
    And the test is in file "features/addition.feature" at line 11
    And the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 3 steps

    When I look at the step #2
    Then the step is called "I add 1 to 7"
