import { DataTable, Given, When } from '@cucumber/cucumber';
import type { TestWorld } from './harness.ts';
import { generateFlakinessReport } from './harness.ts';

Given<TestWorld>('the project file {string}:', function(filePath: string, content: string) {
  this.projectFiles ??= {};
  this.projectFiles[filePath] = content;
});

Given<TestWorld>('the environment variable {string} is {string}', function(name: string, value: string) {
  this.projectEnv ??= {};
  this.projectEnv[name] = value;
});

Given<TestWorld>('the Cucumber arguments are:', function(args: DataTable) {
  this.projectArgs = args.raw().flatMap(row => row);
});

When<TestWorld>('I generate the Flakiness report for {string}', async function(name: string) {
  this.reportResult = await generateFlakinessReport(name, this.projectFiles ?? {}, {
    args: this.projectArgs,
    env: this.projectEnv,
  });
});
