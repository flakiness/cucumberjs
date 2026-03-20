Feature: Rules
  Scenario: captures rules as suites
    Given the project file "features/rules.feature":
      """
      Feature: Wallet

        Rule: Balance cannot go negative
          Scenario: rejects overspending
            Given an account with a balance
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      Given('an account with a balance', function() {});
      """
    When I generate the Flakiness report for "rules"
    Then the report hierarchy is:
      """
      `- file rules.feature
         `- suite Wallet
            `- suite Balance cannot go negative
               `- test rejects overspending
                  `- attempt #1 passed
                     `- step Given an account with a balance
      """
