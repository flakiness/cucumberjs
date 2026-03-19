import { Given } from '@cucumber/cucumber';
import type { TestWorld } from './harness.ts';
import { generateFlakinessReport } from './harness.ts';

Given<TestWorld>('a scenario report with before and after hooks', async function() {
  this.reportResult = await generateFlakinessReport('scenario with hooks', {
    'features/passing.feature': `
      Feature: Hooks
        Scenario: it runs hooks
          Given a passing step
    `,
    'features/support/steps.js': `
      const { Before, After, Given } = require('@cucumber/cucumber');
      Before(function() {});
      After(function() {});
      Given('a passing step', function() {});
    `,
  }, {
    env: {
      BUILD_URL: 'https://ci.example.test/build/123',
    },
  });
});
