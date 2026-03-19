Feature: Tags
  Scenario: captures test steps
    Given a passing scenario report

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    Then I look at the test #1
    And the test contains 1 attempt
    
    Then I look at the attempt #1
    And the attempt contains 1 step

    Then I look at the step #1
    Then the step is called "a passing step"