Feature: STDIO
  Scenario: captures Cucumber log output as attempt stdio
    Given the project file "features/logging.feature":
      """
      Feature: Logging
        Scenario: it logs
          Given a logging step
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      Given('a logging step', async function() {
        this.log('hello from log');
        await new Promise(resolve => setTimeout(resolve, 30));
        this.log('second line');
      });
      """
    When I generate the Flakiness report for "scenario with cucumber log output"

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    Then the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 2 stdio entries

    When I look at the stdio entry #1
    Then the stdio entry has text "hello from log"

    When I look at the stdio entry #2
    Then the stdio entry has text "second line"
    And the stdio entry happened after the previous stdio entry
