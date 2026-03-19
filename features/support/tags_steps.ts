import { Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TestWorld } from './harness.ts';

Then<TestWorld>('the test has tags {string}', function(tags: string) {
  assert.deepEqual(
    [...(this.test?.tags ?? [])].sort(),
    tags.split(',').map(tag => tag.trim()).filter(Boolean).sort(),
  );
});
