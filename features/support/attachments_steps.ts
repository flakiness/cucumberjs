import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { TestWorld } from './harness.ts';
import { assertCount, generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a scenario report with attachments', async function() {
  this.reportResult = await generateFlakinessReport('scenario with attachments', {
    'features/attachments.feature': `
      Feature: Attachments
        Scenario: it attaches data
          Given a step with attachments
    `,
    'features/support/steps.js': `
      const { Given } = require('@cucumber/cucumber');

      Given('a step with attachments', function() {
        this.attach('hello attachment', { mediaType: 'text/plain', fileName: 'note.txt' });
        this.attach(Buffer.from('{"ok":true}', 'utf8'), { mediaType: 'application/json', fileName: 'data.json' });
      });
    `,
  });
});

When<TestWorld>('I look at the attachment #{int}', function(attachmentIdx: number) {
  this.attachment = this.attempt?.attachments?.[attachmentIdx - 1];
});

Then<TestWorld>('the attempt contains {int} attachments', function(expectedAttachments: number) {
  assertCount(this.attempt?.attachments, expectedAttachments);
});

Then<TestWorld>('the report contains {int} missing attachments', function(expectedMissingAttachments: number) {
  assertCount(this.reportResult?.missingAttachments, expectedMissingAttachments);
});

Then<TestWorld>('the attachment is called {string}', function(expectedName: string) {
  assert.equal(this.attachment?.name, expectedName);
});

Then<TestWorld>('the attachment has content type {string}', function(expectedContentType: string) {
  assert.equal(this.attachment?.contentType, expectedContentType);
});

Then<TestWorld>('the stored attachment has text {string}', function(expectedText: string) {
  assert.ok(this.attachment, 'Expected attachment to be selected');
  const storedAttachment = this.reportResult?.attachments.find(attachment => attachment.id === this.attachment?.id);
  assert.ok(storedAttachment, `Expected stored attachment for ${this.attachment.id}`);
  assert.equal(fs.readFileSync(storedAttachment.path, 'utf8'), expectedText);
});
