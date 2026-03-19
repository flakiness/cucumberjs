Feature: Attachments
  Scenario: captures Cucumber attachments
    Given the project file "features/attachments.feature":
      """
      Feature: Attachments
        Scenario: it attaches data
          Given a step with attachments
      """
    And the project file "features/support/steps.js":
      """
      const { Given } = require('@cucumber/cucumber');
      Given('a step with attachments', function() {
        this.attach('hello attachment', { mediaType: 'text/plain', fileName: 'note.txt' });
        this.attach(Buffer.from('{"ok":true}', 'utf8'), { mediaType: 'application/json', fileName: 'data.json' });
      });
      """
    When I generate the Flakiness report for "scenario with attachments"

    When I look at the suite #1
    And I look at the suite #1
    Then the suite contains 1 test

    When I look at the test #1
    Then the test contains 1 attempt

    When I look at the attempt #1
    Then the attempt contains 2 attachments
    And the report contains 0 missing attachments

    When I look at the attachment #1
    Then the attachment is called "note.txt"
    And the attachment has content type "text/plain"
    And the stored attachment has text "hello attachment"

    When I look at the attachment #2
    Then the attachment is called "data.json"
    And the attachment has content type "application/json"
    And the stored attachment has text "{\"ok\":true}"
