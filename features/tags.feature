Feature: Tags
  Scenario: captures test tags
    Given a tagged scenario report

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
      Then the test has tags "feature-tag, smoke, fast"
