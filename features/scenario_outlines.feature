Feature: Scenario Outlines
  Scenario: captures one reported test per example row
    Given a scenario outline report

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 2 tests

    When I look at the test #1
    Then the test is called "addition [a=2, b=2, result=4]"
    And the test is in file "features/addition.feature" at line 11
    And the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 3 steps

    When I look at the step #2
    Then the step is called "I add 2 to 2"

    When I look at the test #2
    Then the test is called "addition [a=1, b=7, result=8]"
    And the test is in file "features/addition.feature" at line 12
    And the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 3 steps

    When I look at the step #2
    Then the step is called "I add 1 to 7"
