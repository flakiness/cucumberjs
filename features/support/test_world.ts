import type { IWorld } from '@cucumber/cucumber';
import type { FlakinessReport as FK } from '@flakiness/flakiness-report';
import type { GenerateFlakinessReportResult, SampleProjectFiles } from './harness.ts';

export type TestWorld = IWorld & {
  reportResult?: GenerateFlakinessReportResult,
  files?: SampleProjectFiles,
  suite?: FK.Suite,
  test?: FK.Test,
};
