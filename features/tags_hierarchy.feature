Feature: Labels
  Scenario: captures inherited tags across a feature tree
    Given the project file "features/hierarchy-tags.feature":
      """
      @checkout
      Feature: Checkout flow

        Scenario: guest checkout
          Given a guest begins checkout

        @card
        Rule: Card payments
          @visa
          Scenario: paying with a saved card
            Given a saved card is available

          Scenario: paying with a new card
            Given a new card is entered
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');

      Given('a guest begins checkout', function() {});
      Given('a saved card is available', function() {});
      Given('a new card is entered', function() {});
      """
    When I generate the Flakiness report for "hierarchy tags"

    When I look at the test named "guest checkout"
    Then the test has tags "checkout"

    When I look at the test named "paying with a saved card"
    Then the test has tags "checkout, card, visa"

    When I look at the test named "paying with a new card"
    Then the test has tags "checkout, card"
