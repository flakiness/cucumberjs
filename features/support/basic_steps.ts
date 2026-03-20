import { BeforeAll, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { TestWorld } from './harness.ts';
import { ARTIFACTS_DIR, assertCount } from './harness.ts';
import type { FlakinessReport as FK } from '@flakiness/flakiness-report';

BeforeAll(function() {
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
});

Then<TestWorld>('the report should contain the basic metadata', function() {
  assert.ok(this.reportResult, 'Expected report result to be defined');
  const { report, log } = this.reportResult;

  assert.equal(report.category, 'cucumberjs');
  assert.equal(report.url, 'https://ci.example.test/build/123');
  assert.equal(report.environments.length, 1);
  assert.equal(report.environments[0]?.name, 'cucumberjs');
  assert.ok(report.commitId, 'Expected commitId to be present');
  assert.ok(report.startTimestamp > 0, 'Expected startTimestamp to be present');
  assert.ok(report.duration > 0, 'Expected duration to be positive');

  assert.ok((report.cpuCount ?? 0) > 0, 'Expected cpuCount to be populated');
  assert.ok((report.cpuAvg?.length ?? 0) > 0, 'Expected cpuAvg telemetry to be populated');
  assert.ok((report.cpuMax?.length ?? 0) > 0, 'Expected cpuMax telemetry to be populated');
  assert.ok((report.ramBytes ?? 0) > 0, 'Expected ramBytes to be populated');
  assert.ok((report.ram?.length ?? 0) > 0, 'Expected ram telemetry to be populated');

  assert.equal(log.stderr, '', `Expected stderr to be empty.\n\nSTDERR:\n${log.stderr}`);
  assert.ok(log.stdout.includes('npx flakiness show'), `Expected report hint in stdout.\n\nSTDOUT:\n${log.stdout}`);
});

When<TestWorld>('I look at the suite named {string}', function(title: string) {
  this.suite = findUnique(
    collectSuites(this.reportResult?.report?.suites ?? []),
    suite => suite.title === title,
    `suite named ${JSON.stringify(title)}`,
  );
  this.test = undefined;
  this.attempt = undefined;
  this.step = undefined;
  this.attachment = undefined;
  this.stdio = undefined;
});

When<TestWorld>('I look at the test named {string}', function(title: string) {
  this.test = findUnique(
    collectTests(this.reportResult?.report?.suites ?? []),
    test => test.title === title,
    `test named ${JSON.stringify(title)}`,
  );
  this.attempt = undefined;
  this.step = undefined;
  this.attachment = undefined;
  this.stdio = undefined;
});

When<TestWorld>('I look at the attempt #{int}', function(attemptIdx) {
  this.attempt = this.test?.attempts[attemptIdx - 1];
  this.step = undefined;
  this.attachment = undefined;
  this.stdio = undefined;
});

When<TestWorld>('I look at the {string} attempt', function(status: string) {
  this.attempt = findUnique(
    this.test?.attempts ?? [],
    attempt => (attempt.status ?? 'passed') === status,
    `${JSON.stringify(status)} attempt`,
  );
  this.step = undefined;
  this.attachment = undefined;
  this.stdio = undefined;
});

When<TestWorld>('I look at the step #{int}', function(stepIdx) {
  this.step = this.attempt?.steps?.[stepIdx - 1];
  this.attachment = undefined;
  this.stdio = undefined;
});

When<TestWorld>('I look at the step named {string}', function(title: string) {
  this.step = findUnique(
    this.attempt?.steps ?? [],
    step => step.title === title,
    `step named ${JSON.stringify(title)}`,
  );
  this.attachment = undefined;
  this.stdio = undefined;
});

Then<TestWorld>('the report contains {int} test(s)', function(expectedTests: number) {
  assertCount(collectTests(this.reportResult?.report?.suites ?? []), expectedTests);
});

Then<TestWorld>('the report hierarchy is:', function(expectedHierarchy: string) {
  const hierarchy = renderReportHierarchy(this.reportResult?.report);
  assert.equal(normalizeMultiline(hierarchy), normalizeMultiline(expectedHierarchy));
});

Then<TestWorld>('the suite contains {int} test(s)', function(expectedTests: number) {
  assertCount(this.suite?.tests, expectedTests);
});

Then<TestWorld>('the test contains {int} attempt(s)', function(expectedAttempts: number) {
  assertCount(this.test?.attempts, expectedAttempts);
});

Then<TestWorld>('the attempt contains {int} step(s)', function(expectedSteps: number) {
  assertCount(this.attempt?.steps, expectedSteps);
});

Then<TestWorld>('the attempt contains {int} step(s):', function(expectedSteps: number, expectedStepTitles: string) {
  const steps = assertCount(this.attempt?.steps, expectedSteps);
  assert.deepEqual(
    steps.map(step => step.title),
    parseMultilineList(expectedStepTitles),
  );
});

Then<TestWorld>('every attempt has a parallel index', function() {
  const attempts = collectAttempts(this.reportResult?.report?.suites ?? []);
  assert.ok(attempts.length > 0, 'Expected the report to contain at least one attempt');
  for (const [index, attempt] of attempts.entries())
    assert.notEqual(attempt.parallelIndex, undefined, `Expected attempt #${index + 1} to have a parallel index`);
});

Then<TestWorld>('the report contains {int} distinct parallel index(es)', function(expectedIndexes: number) {
  assert.equal(collectDistinctParallelIndexes(this.reportResult?.report?.suites ?? []).length, expectedIndexes);
});

Then<TestWorld>('the report parallel indexes are in range {int} to {int}', function(minIndex: number, maxIndex: number) {
  const attempts = collectAttempts(this.reportResult?.report?.suites ?? []);
  assert.ok(attempts.length > 0, 'Expected the report to contain at least one attempt');
  for (const [index, attempt] of attempts.entries()) {
    assert.notEqual(attempt.parallelIndex, undefined, `Expected attempt #${index + 1} to have a parallel index`);
    assert.ok(
      attempt.parallelIndex! >= minIndex && attempt.parallelIndex! <= maxIndex,
      `Expected attempt #${index + 1} to have parallel index in range ${minIndex}..${maxIndex}, got ${attempt.parallelIndex}`,
    );
  }
});

Then<TestWorld>('the step contains {int} steps(s)', function(expectedSteps: number) {
  assertCount(this.step?.steps, expectedSteps);
});

Then<TestWorld>('attempt #{int} is {string}', function(attemptIdx, status) {
  assert.equal(this.test?.attempts[attemptIdx - 1]?.status ?? 'passed', status);
});

Then<TestWorld>('attempt #{int} and attempt #{int} have the same parallel index', function(firstAttemptIdx: number, secondAttemptIdx: number) {
  assert.equal(
    this.test?.attempts[firstAttemptIdx - 1]?.parallelIndex,
    this.test?.attempts[secondAttemptIdx - 1]?.parallelIndex,
  );
});

Then<TestWorld>('the suite is called {string}', function(title) {
  assert.equal(this.suite?.title, title);
});

Then<TestWorld>('the suite is in file {string} at line {int}', function(file, line) {
  assert.equal(this.suite?.location?.file, file);
  assert.equal(this.suite?.location?.line, line);
});

Then<TestWorld>('the test is called {string}', function(title) {
  assert.equal(this.test?.title, title);
});

Then<TestWorld>('the test is in file {string} at line {int}', function(file, line) {
  assert.equal(this.test?.location?.file, file);
  assert.equal(this.test?.location?.line, line);
});

Then<TestWorld>('the step is called {string}', function(title) {
  assert.equal(this.step?.title, title);
});

Then<TestWorld>('the step #{int} is called {string}', function(stepIdx: number, title: string) {
  assert.equal(this.attempt?.steps?.[stepIdx - 1]?.title, title);
});

Then<TestWorld>('the step is in file {string} at line {int}', function(file, line) {
  assert.equal(this.step?.location?.file, file);
  assert.equal(this.step?.location?.line, line);
});

function collectSuites(suites: FK.Suite[]): FK.Suite[] {
  return suites.flatMap(suite => [suite, ...collectSuites(suite.suites ?? [])]);
}

function collectTests(suites: FK.Suite[]): FK.Test[] {
  return suites.flatMap(suite => [...(suite.tests ?? []), ...collectTests(suite.suites ?? [])]);
}

function collectAttempts(suites: FK.Suite[]): FK.RunAttempt[] {
  return collectTests(suites).flatMap(test => test.attempts);
}

function collectDistinctParallelIndexes(suites: FK.Suite[]): number[] {
  return Array.from(new Set(collectAttempts(suites).flatMap(attempt => attempt.parallelIndex === undefined ? [] : [attempt.parallelIndex]))).sort((a, b) => a - b);
}

function findUnique<T>(elements: T[], predicate: (element: T) => boolean, description: string): T {
  const matches = elements.filter(predicate);
  assert.equal(matches.length, 1, `Expected exactly 1 ${description}, got ${matches.length}`);
  return matches[0]!;
}

function renderReportHierarchy(report: FK.Report | undefined): string {
  return renderTree(
    (report?.suites ?? []).map(suite => renderSuiteNode(suite)),
  );
}

type TreeNode = {
  label: string,
  children?: TreeNode[],
};

function renderSuiteNode(suite: FK.Suite): TreeNode {
  const label = suite.type === 'file' ? `file ${suite.title}` : `suite ${suite.title}`;
  return {
    label,
    children: [
      ...(suite.suites ?? []).map(renderSuiteNode),
      ...(suite.tests ?? []).map(renderTestNode),
    ],
  };
}

function renderTestNode(test: FK.Test): TreeNode {
  return {
    label: `test ${test.title}`,
    children: test.attempts.map((attempt, index) => ({
      label: `attempt #${index + 1} ${attempt.status ?? 'passed'}`,
      children: (attempt.steps ?? []).map(step => ({
        label: `step ${step.title}`,
      })),
    })),
  };
}

function renderTree(nodes: TreeNode[]): string {
  return nodes.flatMap((node, index) => renderTreeNode(node, '', index === nodes.length - 1)).join('\n');
}

function renderTreeNode(node: TreeNode, prefix: string, isLast: boolean): string[] {
  const branch = isLast ? '`- ' : '|- ';
  const childPrefix = prefix + (isLast ? '   ' : '|  ');
  return [
    `${prefix}${branch}${node.label}`,
    ...(node.children ?? []).flatMap((child, index, children) => renderTreeNode(child, childPrefix, index === children.length - 1)),
  ];
}

function normalizeMultiline(text: string): string {
  return text
    .trim()
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

function parseMultilineList(text: string): string[] {
  return normalizeMultiline(text)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}
