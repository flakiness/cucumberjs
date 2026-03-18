import { Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TestWorld } from './test_world.ts';
import { generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a tagged scenario report', async function() {
  this.reportResult = await generateFlakinessReport('tagged scenario', {
    'features/tagged.feature': `
      @feature-tag
      Feature: Tagged
        @smoke @fast
        Scenario: it has tags
          Given a passing step
    `,
    'features/support/steps.js': `
      const { Given } = require('@cucumber/cucumber');

      Given('a passing step', function() {});
    `,
  }, {
    env: {
      BUILD_URL: 'https://ci.example.test/build/123',
    },
  });
});

Then<TestWorld>('the test has tags {string}', function(tags: string) {
  assert.deepEqual(
    [...(this.test?.tags ?? [])].sort(),
    tags.split(',').map(tag => tag.trim()).filter(Boolean).sort(),
  );
});
