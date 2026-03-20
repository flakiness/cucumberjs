Feature: Descriptions

  Scenario: captures native Gherkin descriptions as annotations
    Given the project file "features/help-center.feature":
      """
      Feature: Help center
        These scenarios describe what support agents can read.
        They should stay visible in the report.

        Scenario: opens a pinned article
          Support agents can inspect a pinned article before replying.
          Given a pinned article exists

        Scenario: lists pinned articles
          Given several pinned articles exist
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');

      Given('a pinned article exists', function() {});
      Given('several pinned articles exist', function() {});
      """
    When I generate the Flakiness report for "descriptions"

    When I look at the test named "opens a pinned article"
    Then the test contains 1 attempt
    When I look at the attempt #1
    Then the attempt contains 2 annotations
    And the attempt has an annotation "feature" with description:
      """
      These scenarios describe what support agents can read.
      They should stay visible in the report.
      """
    And the attempt has an annotation "scenario" with description:
      """
      Support agents can inspect a pinned article before replying.
      """

    When I look at the test named "lists pinned articles"
    Then the test contains 1 attempt
    When I look at the attempt #1
    Then the attempt contains 1 annotation
    And the attempt has an annotation "feature" with description:
      """
      These scenarios describe what support agents can read.
      They should stay visible in the report.
      """
    And the attempt has no annotation "scenario"
