import { Then } from '@cucumber/cucumber';
import type { FlakinessReport as FK } from '@flakiness/flakiness-report';
import assert from 'node:assert/strict';
import type { TestWorld } from './harness.ts';
import { assertCount } from './harness.ts';

Then<TestWorld>('the attempt contains {int} annotation(s)', function(expectedAnnotations: number) {
  assertCount(this.attempt?.annotations, expectedAnnotations);
});

Then<TestWorld>('the attempt has an annotation {string} with description:', function(type: string, description: string) {
  const annotation = findAnnotation(this.attempt?.annotations, type);
  assert.equal(normalizeMultiline(annotation.description ?? ''), normalizeMultiline(description));
});

Then<TestWorld>('the attempt has no annotation {string}', function(type: string) {
  const annotations = this.attempt?.annotations ?? [];
  assert.equal(
    annotations.filter(annotation => annotation.type === type).length,
    0,
    `Expected no annotation of type ${JSON.stringify(type)}, got ${annotations.filter(annotation => annotation.type === type).length}`,
  );
});

function findAnnotation(annotations: FK.Annotation[] | undefined, type: string): FK.Annotation {
  const matches = (annotations ?? []).filter(annotation => annotation.type === type);
  assert.equal(matches.length, 1, `Expected exactly 1 annotation of type ${JSON.stringify(type)}, got ${matches.length}`);
  return matches[0]!;
}

function normalizeMultiline(text: string): string {
  return text
    .trim()
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}
