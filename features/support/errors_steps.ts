import { Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TestWorld } from './harness.ts';
import { assertCount } from './harness.ts';

Then<TestWorld>('the attempt contains {int} error', function(expectedErrors: number) {
  assertCount(this.attempt?.errors, expectedErrors);
});

Then<TestWorld>('the attempt error #{int} has message {string}', function(errorIdx: number, message: string) {
  assert.equal(this.attempt?.errors?.[errorIdx - 1]?.message, message);
});

Then<TestWorld>('the attempt error #{int} has message containing {string}', function(errorIdx: number, text: string) {
  assert.ok(
    this.attempt?.errors?.[errorIdx - 1]?.message?.includes(text),
    `Expected attempt error message to contain ${JSON.stringify(text)}, got ${JSON.stringify(this.attempt?.errors?.[errorIdx - 1]?.message)}`,
  );
});

Then<TestWorld>('the attempt error #{int} has a stack trace', function(errorIdx: number) {
  assert.ok(this.attempt?.errors?.[errorIdx - 1]?.stack, 'Expected error stack to be present');
});

Then<TestWorld>('the attempt error #{int} has a snippet containing {string}', function(errorIdx: number, text: string) {
  assert.ok(
    this.attempt?.errors?.[errorIdx - 1]?.snippet?.includes(text),
    `Expected attempt error snippet to contain ${JSON.stringify(text)}, got ${JSON.stringify(this.attempt?.errors?.[errorIdx - 1]?.snippet)}`,
  );
});

Then<TestWorld>('the step has an error with message {string}', function(message: string) {
  assert.equal(this.step?.error?.message, message);
});

Then<TestWorld>('the step has an error with message containing {string}', function(text: string) {
  assert.ok(
    this.step?.error?.message?.includes(text),
    `Expected step error message to contain ${JSON.stringify(text)}, got ${JSON.stringify(this.step?.error?.message)}`,
  );
});

Then<TestWorld>('the step error has a snippet containing {string}', function(text: string) {
  assert.ok(
    this.step?.error?.snippet?.includes(text),
    `Expected step error snippet to contain ${JSON.stringify(text)}, got ${JSON.stringify(this.step?.error?.snippet)}`,
  );
});
