Feature: Multiple Scenario Outline Examples
  Scenario: captures multiple examples blocks
    Given the project file "features/checkout-totals.feature":
      """
      Feature: Checkout totals
        Scenario Outline: totals
          Given the subtotal is <subtotal> and tax is <tax> and the total is <total>

          @priority
          Examples: common orders
            | subtotal | tax | total |
            | 1        | 2   | 3     |
            | 2        | 2   | 4     |

          Examples:
            | subtotal | tax | total |
            | 3        | 10  | 13    |
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');

      Given('the subtotal is {int} and tax is {int} and the total is {int}', function(subtotal, tax, total) {});
      """
    When I generate the Flakiness report for "multiple examples"
    Then the report contains 3 tests

    When I look at the test named "totals [subtotal=1, tax=2, total=3]"
    And the test is in file "features/checkout-totals.feature" at line 8
    And the test has tags "priority"
    And the test contains 1 attempt
    When I look at the attempt #1
    Then the attempt contains 1 step:
      """
      the subtotal is 1 and tax is 2 and the total is 3
      """

    When I look at the test named "totals [subtotal=2, tax=2, total=4]"
    And the test is in file "features/checkout-totals.feature" at line 9
    And the test has tags "priority"

    When I look at the test named "totals [subtotal=3, tax=10, total=13]"
    And the test is in file "features/checkout-totals.feature" at line 13
    And the test has tags ""
