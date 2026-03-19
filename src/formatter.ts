import type { IFormatterOptions } from '@cucumber/cucumber';
import { Formatter, formatterHelpers } from '@cucumber/cucumber';
import type {
  Duration,
  Envelope,
  Location,
  TestCaseFinished,
  TestCaseStarted,
  TestRunFinished,
  TestRunStarted,
  Timestamp,
} from '@cucumber/messages';
import {
  TestStepResultStatus,
} from '@cucumber/messages';
import { FlakinessReport as FK } from '@flakiness/flakiness-report';
import {
  CIUtils,
  CPUUtilization,
  GitWorktree,
  RAMUtilization,
  ReportUtils,
  uploadReport,
  writeReport
} from '@flakiness/sdk';
import path from 'node:path';

type FormatterConfig = {
  disableUpload?: boolean,
  endpoint?: string,
  flakinessProject?: string,
  outputFolder?: string,
  token?: string,
};

type LineAndUri = {
  line: number,
  uri: string,
};

export default class FlakinessCucumberFormatter extends Formatter {
  static documentation = 'Generates a Flakiness report for a CucumberJS run.';

  private _config: FormatterConfig;
  private _cpuUtilization = new CPUUtilization({ precision: 10 });
  private _ramUtilization = new RAMUtilization({ precision: 10 });
  private _startTimestamp = Date.now() as FK.UnixTimestampMS;
  private _outputFolder: string;
  private _telemetryTimer?: NodeJS.Timeout;

  private _finishedPromise = new ManualPromise();
  private _testCaseStartedById = new Map<string, TestCaseStarted>();
  private _testCaseFinishedById = new Map<string, TestCaseFinished>();

  constructor(options: IFormatterOptions) {
    super(options);
    this._config = parseFormatterConfig(options.parsedArgvOptions);
    this._outputFolder = path.resolve(this.cwd, this._config.outputFolder ?? process.env.FLAKINESS_OUTPUT_DIR ?? 'flakiness-report');

    this._sampleSystem = this._sampleSystem.bind(this);
    this._sampleSystem();

    // Cucumber emits a stream of protocol messages; each message is wrapped
    // in an Envelope and carries one payload such as testRunStarted or attachment.
    options.eventBroadcaster.on('envelope', (envelope: Envelope) => {
      if (envelope.testRunStarted)
        this._onTestRunStarted(envelope.testRunStarted);
      if (envelope.testCaseStarted)
        this._onTestCaseStarted(envelope.testCaseStarted);
      if (envelope.testCaseFinished)
        this._onTestCaseFinished(envelope.testCaseFinished);

      if (envelope.testRunFinished) {
        this._onTestRunFinished(envelope.testRunFinished)
          .then(() => this._finishedPromise.resolve(undefined))
          .catch((e) => this._finishedPromise.reject(e));
      }
    });
  }

  private _onTestRunStarted(testRunStarted: TestRunStarted) {
    this._startTimestamp = toUnixTimestampMS(testRunStarted.timestamp);
  }

  private _onTestCaseStarted(testCaseStarted: TestCaseStarted) {
    this._testCaseStartedById.set(testCaseStarted.id, testCaseStarted);
  }

  private _onTestCaseFinished(testCaseFinished: TestCaseFinished) {
    this._testCaseFinishedById.set(testCaseFinished.testCaseStartedId, testCaseFinished);
  }

  override async finished(): Promise<void> {
    if (this._telemetryTimer)
      clearTimeout(this._telemetryTimer);

    try {
      await this._finishedPromise.promise;
    } catch (error) {
      console.error(`[flakiness.io] Failed to generate report: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);      
    }

    await super.finished();
  }

  private _sampleSystem(): void {
    this._cpuUtilization.sample();
    this._ramUtilization.sample();
    this._telemetryTimer = setTimeout(this._sampleSystem, 1000);
  }

  private async _onTestRunFinished(testRunFinished: TestRunFinished): Promise<void> {
    this._cpuUtilization.sample();
    this._ramUtilization.sample();

    let worktree: GitWorktree;
    let commitId: FK.CommitId;
    try {
      worktree = GitWorktree.create(this.cwd);
      commitId = worktree.headCommitId();
    } catch {
      console.warn('[flakiness.io] Failed to fetch commit info - is this a git repo?');
      console.error('[flakiness.io] Report is NOT generated.');
      return;
    }

    const report = ReportUtils.normalizeReport({
      category: 'cucumberjs',
      commitId,
      duration: (toUnixTimestampMS(testRunFinished.timestamp) - this._startTimestamp) as FK.DurationMS,
      environments: [
        ReportUtils.createEnvironment({
          name: 'cucumberjs',
        }),
      ],
      flakinessProject: this._config.flakinessProject,
      suites: this._collectSuites(worktree),
      startTimestamp: this._startTimestamp,
      url: CIUtils.runUrl(),
    });
    ReportUtils.collectSources(worktree, report);
    this._cpuUtilization.enrich(report);
    this._ramUtilization.enrich(report);

    await writeReport(report, [], this._outputFolder);

    const disableUpload = this._config.disableUpload ?? envBool('FLAKINESS_DISABLE_UPLOAD');
    if (!disableUpload) {
      await uploadReport(report, [], {
        flakinessAccessToken: this._config.token,
        flakinessEndpoint: this._config.endpoint,
      });
    }

    const defaultOutputFolder = path.join(this.cwd, 'flakiness-report');
    const folder = defaultOutputFolder === this._outputFolder ? '' : path.relative(this.cwd, this._outputFolder);
    this.log(`
To open last Flakiness report, run:

  npx flakiness show ${folder}
`);
  }

  private _collectSuites(worktree: GitWorktree): FK.Suite[] {
    const uriToFile = new Map<string, FK.Suite>();
    const uriToTests = new Map<string, Map<string, FK.Test>>();

    for (const [testCaseStartedId, testCaseStarted] of this._testCaseStartedById) {
      const attemptData = this.eventDataCollector.getTestCaseAttempt(testCaseStartedId);
      const parsedAttempt = formatterHelpers.parseTestCaseAttempt({
        testCaseAttempt: attemptData,
        snippetBuilder: this.snippetBuilder,
        supportCodeLibrary: this.supportCodeLibrary,
      });
      const featureUri = attemptData.pickle.uri;
      let fileSuite = uriToFile.get(featureUri);

      if (!fileSuite) {
        fileSuite = {
          type: 'file',
          title: path.basename(featureUri),
          location: createLocation(worktree, this.cwd, featureUri, { line: 0, column: 0 }),
          suites: [{
            type: 'suite',
            title: attemptData.gherkinDocument.feature?.name ?? '',
            location: attemptData.gherkinDocument.feature?.location
              ? createLocation(worktree, this.cwd, featureUri, attemptData.gherkinDocument.feature?.location)
              : undefined,
            tests: [],
          }],
        };
        uriToFile.set(featureUri, fileSuite);
        uriToTests.set(featureUri, new Map());
      }

      const testsById = uriToTests.get(featureUri)!;
      let test = testsById.get(attemptData.testCase.id);
      if (!test) {
        test = {
          title: attemptData.pickle.name,
          location: attemptData.pickle.location
            ? createLocation(worktree, this.cwd, featureUri, attemptData.pickle.location)
            : undefined,
          tags: attemptData.pickle.tags.map(tag => stripTagPrefix(tag.name)),
          attempts: [],
        };
        testsById.set(attemptData.testCase.id, test);
        fileSuite.suites![0].tests!.push(test);
      }

      const testCaseFinished = this._testCaseFinishedById.get(testCaseStartedId);
      const startTimestamp = toUnixTimestampMS(testCaseStarted.timestamp);
      const finishTimestamp = testCaseFinished ? toUnixTimestampMS(testCaseFinished.timestamp) : startTimestamp;
      const errors = parsedAttempt.testSteps
        .map(step => extractErrorFromStep(worktree, this.cwd, step))
        .filter((error): error is FK.ReportError => !!error);

      test.attempts.push({
        environmentIdx: 0,
        startTimestamp,
        duration: Math.max(0, finishTimestamp - startTimestamp) as FK.DurationMS,
        status: toFKStatus(attemptData.worstTestStepResult.status),
        errors: errors.length ? errors : undefined,
        steps: parsedAttempt.testSteps.map(step => ({
          title: toFKStepTitle(step),
          duration: toDurationMS(step.result.duration),
          error: extractErrorFromStep(worktree, this.cwd, step),
          location: step.sourceLocation
            ? createLineAndUriLocation(worktree, this.cwd, step.sourceLocation)
            : step.actionLocation
              ? createLineAndUriLocation(worktree, this.cwd, step.actionLocation)
              : undefined,
        })),
      });
    }

    return Array.from(uriToFile.values());
  }
}

function envBool(name: string): boolean {
  return ['1', 'true'].includes(process.env[name]?.toLowerCase() ?? '');
}

function parseFormatterConfig(parsedArgvOptions: IFormatterOptions['parsedArgvOptions']): FormatterConfig {
  return {
    disableUpload: typeof parsedArgvOptions.disableUpload === 'boolean' ? parsedArgvOptions.disableUpload : undefined,
    endpoint: typeof parsedArgvOptions.endpoint === 'string' ? parsedArgvOptions.endpoint : undefined,
    flakinessProject: typeof parsedArgvOptions.flakinessProject === 'string' ? parsedArgvOptions.flakinessProject : undefined,
    outputFolder: typeof parsedArgvOptions.outputFolder === 'string' ? parsedArgvOptions.outputFolder : undefined,
    token: typeof parsedArgvOptions.token === 'string' ? parsedArgvOptions.token : undefined,
  };
}

function createLocation(worktree: GitWorktree, cwd: string, relativeFile: string, location: Location): FK.Location {
  return {
    file: worktree.gitPath(path.resolve(cwd, relativeFile)),
    line: location.line as FK.Number1Based,
    column: (location.column ?? 1) as FK.Number1Based,
  };
}

function stripTagPrefix(tag: string): string {
  return tag.startsWith('@') ? tag.slice(1) : tag;
}

function toFKStatus(status: TestStepResultStatus | undefined): FK.TestStatus {
  switch (status) {
    case TestStepResultStatus.PASSED:
      return 'passed';
    case TestStepResultStatus.SKIPPED:
      return 'skipped';
    case TestStepResultStatus.UNKNOWN:
      return 'interrupted';
    case TestStepResultStatus.PENDING:
    case TestStepResultStatus.UNDEFINED:
    case TestStepResultStatus.AMBIGUOUS:
    case TestStepResultStatus.FAILED:
      return 'failed';
    default:
      return 'interrupted';
  }
}

function toUnixTimestampMS(timestamp: Timestamp): FK.UnixTimestampMS {
  return (timestamp.seconds * 1000 + Math.floor(timestamp.nanos / 1_000_000)) as FK.UnixTimestampMS;
}

function toDurationMS(timestamp: Duration): FK.DurationMS {
  return (timestamp.seconds * 1000 + Math.floor(timestamp.nanos / 1_000_000)) as FK.DurationMS;
}

function createLineAndUriLocation(worktree: GitWorktree, cwd: string, location: LineAndUri): FK.Location {
  return {
    file: worktree.gitPath(path.resolve(cwd, location.uri)),
    line: location.line as FK.Number1Based,
    column: 1 as FK.Number1Based,
  };
}

function toFKStepTitle(step: ReturnType<typeof formatterHelpers.parseTestCaseAttempt>['testSteps'][number]): string {
  if (step.text)
    return step.text;
  if (step.name)
    return `${step.keyword} (${step.name})`;
  return step.keyword;
}

function extractErrorFromStep(
  worktree: GitWorktree,
  cwd: string,
  step: ReturnType<typeof formatterHelpers.parseTestCaseAttempt>['testSteps'][number],
): FK.ReportError | undefined {
  const status = step.result.status;
  if (
    status === TestStepResultStatus.PASSED ||
    status === TestStepResultStatus.SKIPPED ||
    status === TestStepResultStatus.UNKNOWN
  ) {
    return undefined;
  }

  const message = step.result.exception?.message ?? step.result.message;
  const stack = step.result.exception?.stackTrace;
  const value = !message && step.result.exception?.type ? step.result.exception.type : undefined;
  const location = step.sourceLocation
    ? createLineAndUriLocation(worktree, cwd, step.sourceLocation)
    : step.actionLocation
      ? createLineAndUriLocation(worktree, cwd, step.actionLocation)
      : undefined;

  if (!message && !stack && !value)
    return undefined;

  return {
    location,
    message,
    stack,
    value,
  };
}

class ManualPromise<T> {
  readonly promise: Promise<T>;
  private _resolve!: (t: T) => void;
  private _reject!: (err: any) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  resolve(e: T) {
    this._resolve(e);
  }

  reject(e: any) {
    this._reject(e);
  }
}
