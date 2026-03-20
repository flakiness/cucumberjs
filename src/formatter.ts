import type { IFormatterOptions } from '@cucumber/cucumber';
import { Formatter, formatterHelpers } from '@cucumber/cucumber';
import type {
  Attachment as CucumberAttachment,
  Duration,
  Envelope,
  Feature,
  GherkinDocument,
  Location,
  Pickle,
  Rule,
  Scenario,
  TestCaseFinished,
  TestCaseStarted,
  TestRunFinished,
  TestRunStarted,
  Timestamp
} from '@cucumber/messages';
import { AttachmentContentEncoding, TestStepResultStatus } from '@cucumber/messages';
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

type ParsedTestStep = ReturnType<typeof formatterHelpers.parseTestCaseAttempt>['testSteps'][number];
type ReportDataAttachment = Awaited<ReturnType<typeof ReportUtils.createDataAttachment>>;

const CUCUMBER_LOG_MEDIA_TYPE = 'text/x.cucumber.log+plain';

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

    const { attachments, suites } = await this._collectSuites(worktree);

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
      suites,
      startTimestamp: this._startTimestamp,
      url: CIUtils.runUrl(),
    });
    ReportUtils.collectSources(worktree, report);
    this._cpuUtilization.enrich(report);
    this._ramUtilization.enrich(report);

    await writeReport(report, attachments, this._outputFolder);

    const disableUpload = this._config.disableUpload ?? envBool('FLAKINESS_DISABLE_UPLOAD');
    if (!disableUpload) {
      await uploadReport(report, attachments, {
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

  private async _collectSuites(worktree: GitWorktree): Promise<{
    attachments: ReportDataAttachment[],
    suites: FK.Suite[],
  }> {
    const suitesByKey = new Map<string, FK.Suite>();
    const testsById = new Map<string, FK.Test>();
    const attachments = new Map<FK.AttachmentId, ReportDataAttachment>();

    for (const [testCaseStartedId, testCaseStarted] of this._testCaseStartedById) {
      const attemptData = this.eventDataCollector.getTestCaseAttempt(testCaseStartedId);
      const parsedAttempt = formatterHelpers.parseTestCaseAttempt({
        testCaseAttempt: attemptData,
        snippetBuilder: this.snippetBuilder,
        supportCodeLibrary: this.supportCodeLibrary,
      });
      const featureUri = attemptData.pickle.uri;
      const fileSuite = getOrCreateFileSuite(suitesByKey, worktree, this.cwd, featureUri);
      const featureSuite = getOrCreateFeatureSuite(
        suitesByKey,
        fileSuite,
        worktree,
        this.cwd,
        featureUri,
        attemptData.gherkinDocument,
      );
      const rule = findRuleForPickle(attemptData.gherkinDocument, attemptData.pickle);
      const parentSuite = rule
        ? getOrCreateRuleSuite(suitesByKey, featureSuite, worktree, this.cwd, featureUri, rule)
        : featureSuite;

      let test = testsById.get(attemptData.testCase.id);
      if (!test) {
        test = {
          title: toFKTestTitle(attemptData.gherkinDocument, attemptData.pickle),
          location: attemptData.pickle.location
            ? createLocation(worktree, this.cwd, featureUri, attemptData.pickle.location)
            : undefined,
          tags: attemptData.pickle.tags.map(tag => stripTagPrefix(tag.name)),
          attempts: [],
        };
        testsById.set(attemptData.testCase.id, test);
        parentSuite.tests!.push(test);
      }

      const testCaseFinished = this._testCaseFinishedById.get(testCaseStartedId);
      const startTimestamp = toUnixTimestampMS(testCaseStarted.timestamp);
      const finishTimestamp = testCaseFinished ? toUnixTimestampMS(testCaseFinished.timestamp) : startTimestamp;
      const errors = parsedAttempt.testSteps
        .map(step => extractErrorFromStep(worktree, this.cwd, step))
        .filter((error): error is FK.ReportError => !!error);
      const stdio = extractSTDIOFromTestSteps(parsedAttempt.testSteps, startTimestamp);

      test.attempts.push({
        environmentIdx: 0,
        startTimestamp,
        duration: Math.max(0, finishTimestamp - startTimestamp) as FK.DurationMS,
        status: toFKStatus(attemptData.worstTestStepResult.status),
        annotations: extractAttemptAnnotations(worktree, this.cwd, featureUri, attemptData.gherkinDocument, attemptData.pickle),
        errors: errors.length ? errors : undefined,
        attachments: await extractAttachmentsFromTestSteps(parsedAttempt.testSteps, attachments),
        stdio: stdio.length ? stdio : undefined,
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

    return {
      attachments: Array.from(attachments.values()),
      suites: Array.from(suitesByKey.values()).filter(suite => suite.type === 'file'),
    };
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

function getOrCreateFileSuite(
  suitesByKey: Map<string, FK.Suite>,
  worktree: GitWorktree,
  cwd: string,
  featureUri: string,
): FK.Suite {
  const key = `file:${featureUri}`;
  let suite = suitesByKey.get(key);
  if (!suite) {
    suite = {
      type: 'file',
      title: path.basename(featureUri),
      location: createLocation(worktree, cwd, featureUri, { line: 0, column: 0 }),
      suites: [],
    };
    suitesByKey.set(key, suite);
  }
  return suite;
}

function getOrCreateFeatureSuite(
  suitesByKey: Map<string, FK.Suite>,
  fileSuite: FK.Suite,
  worktree: GitWorktree,
  cwd: string,
  featureUri: string,
  gherkinDocument: GherkinDocument,
): FK.Suite {
  const key = `feature:${featureUri}`;
  let suite = suitesByKey.get(key);
  if (!suite) {
    suite = {
      type: 'suite',
      title: gherkinDocument.feature?.name ?? '',
      location: gherkinDocument.feature?.location
        ? createLocation(worktree, cwd, featureUri, gherkinDocument.feature.location)
        : undefined,
      suites: [],
      tests: [],
    };
    suitesByKey.set(key, suite);
    fileSuite.suites!.push(suite);
  }
  return suite;
}

function getOrCreateRuleSuite(
  suitesByKey: Map<string, FK.Suite>,
  featureSuite: FK.Suite,
  worktree: GitWorktree,
  cwd: string,
  featureUri: string,
  rule: Rule,
): FK.Suite {
  const key = `rule:${featureUri}:${rule.id}`;
  let suite = suitesByKey.get(key);
  if (!suite) {
    suite = {
      type: 'suite',
      title: rule.name,
      location: createLocation(worktree, cwd, featureUri, rule.location),
      tests: [],
    };
    suitesByKey.set(key, suite);
    featureSuite.suites!.push(suite);
  }
  return suite;
}

function extractAttemptAnnotations(
  worktree: GitWorktree,
  cwd: string,
  featureUri: string,
  gherkinDocument: GherkinDocument,
  pickle: Pickle,
): FK.Annotation[] | undefined {
  const annotations = [
    createDescriptionAnnotation('feature', worktree, cwd, featureUri, gherkinDocument.feature),
    createDescriptionAnnotation('rule', worktree, cwd, featureUri, findRuleForPickle(gherkinDocument, pickle)),
    createDescriptionAnnotation('scenario', worktree, cwd, featureUri, findScenarioForPickle(gherkinDocument, pickle)),
  ].filter((annotation): annotation is FK.Annotation => !!annotation);

  return annotations.length ? annotations : undefined;
}

function createDescriptionAnnotation(
  type: string,
  worktree: GitWorktree,
  cwd: string,
  featureUri: string,
  node: { description: string, location: Location } | undefined,
): FK.Annotation | undefined {
  const description = normalizeDescription(node?.description);
  if (!description || !node)
    return undefined;

  return {
    type,
    description,
    location: createLocation(worktree, cwd, featureUri, node.location),
  };
}

function findRuleForPickle(gherkinDocument: GherkinDocument, pickle: Pickle): Rule | undefined {
  const astNodeIds = new Set(pickle.astNodeIds);
  for (const child of gherkinDocument.feature?.children ?? []) {
    if (!child.rule)
      continue;
    const hasScenario = child.rule.children.some(ruleChild => ruleChild.scenario && astNodeIds.has(ruleChild.scenario.id));
    if (hasScenario)
      return child.rule;
  }
  return undefined;
}

function findScenarioForPickle(gherkinDocument: GherkinDocument, pickle: Pickle): Scenario | undefined {
  const astNodeIds = new Set(pickle.astNodeIds);
  return collectScenarios(gherkinDocument.feature).find(scenario => astNodeIds.has(scenario.id));
}

function toFKTestTitle(gherkinDocument: GherkinDocument, pickle: Pickle): string {
  const exampleValues = extractScenarioOutlineValues(gherkinDocument, pickle);
  if (exampleValues)
    return `${pickle.name} [${exampleValues.map(([key, value]) => `${key}=${value}`).join(', ')}]`;
  return pickle.name;
}

function extractScenarioOutlineValues(gherkinDocument: GherkinDocument, pickle: Pickle): [string, string][] | undefined {
  // `astNodeIds` is the list of Gherkin node IDs that produced it.
  // In practice:
  // - For a normal scenario, it usually includes the scenario node ID.
  // - For a Scenario Outline, it includes the scenario node ID and the selected
  //   example-row node ID.
  // - For steps, individual pickleStep.astNodeIds point back to the original Gherkin
  //   step nodes.
  if (pickle.astNodeIds.length < 2)
    return undefined;

  // The last nodeId is the selected example row.
  const exampleRowId = pickle.astNodeIds[pickle.astNodeIds.length - 1];

  for (const scenario of collectScenarios(gherkinDocument.feature)) {
    for (const examples of scenario.examples) {
      const row = examples.tableBody.find(row => row.id === exampleRowId);
      if (!row)
        continue;

      const headers = examples.tableHeader?.cells.map(cell => cell.value) ?? [];
      return row.cells.map((cell, index) => [headers[index] ?? `column${index + 1}`, cell.value]);
    }
  }

  return undefined;
}

function collectScenarios(feature: Feature | undefined): Scenario[] {
  return (feature?.children ?? []).flatMap(child => {
    if (child.rule)
      return child.rule.children.flatMap(ruleChild => ruleChild.scenario ? [ruleChild.scenario] : []);
    return child.scenario ? [child.scenario] : [];
  });
}

function normalizeDescription(description: string | undefined): string | undefined {
  const value = description?.trim();
  if (!value)
    return undefined;

  const lines = value.split('\n');
  const commonIndent = lines
    .slice(1)
    .filter(line => line.trim())
    .reduce((indent, line) => Math.min(indent, line.match(/^ */)?.[0].length ?? 0), Number.POSITIVE_INFINITY);

  if (!Number.isFinite(commonIndent) || commonIndent === 0)
    return value;

  return [
    lines[0]!,
    ...lines.slice(1).map(line => line.slice(commonIndent)),
  ].join('\n');
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

function toFKStepTitle(step: ParsedTestStep): string {
  return step.text
    ? `${step.keyword}${step.text}`.trim()
    : step.name
      ? `${step.keyword} (${step.name})`
      : step.keyword;
}

function extractErrorFromStep(
  worktree: GitWorktree,
  cwd: string,
  step: ParsedTestStep,
): FK.ReportError | undefined {
  const status = step.result.status;
  if (
    status === TestStepResultStatus.PASSED ||
    status === TestStepResultStatus.SKIPPED ||
    status === TestStepResultStatus.UNKNOWN
  ) {
    return undefined;
  }

  const message = step.result.exception?.message
    ?? step.result.message
    ?? (status === TestStepResultStatus.PENDING
      ? 'Step is pending'
      : status === TestStepResultStatus.UNDEFINED
        ? 'Undefined step'
        : undefined);
  const location = step.sourceLocation
    ? createLineAndUriLocation(worktree, cwd, step.sourceLocation)
    : step.actionLocation
      ? createLineAndUriLocation(worktree, cwd, step.actionLocation)
      : undefined;

  return message ? {
    location,
    message,
    stack: step.result.exception?.stackTrace,
    snippet: step.snippet,
  } : undefined;
}

function extractSTDIOFromTestSteps(
  steps: ParsedTestStep[],
  startTimestamp: FK.UnixTimestampMS,
): FK.TimedSTDIOEntry[] {
  const stdio: FK.TimedSTDIOEntry[] = [];
  let previousTimestamp = startTimestamp;

  for (const step of steps) {
    for (const attachment of step.attachments) {
      if (attachment.mediaType !== CUCUMBER_LOG_MEDIA_TYPE)
        continue;

      const timestamp = attachment.timestamp ? toUnixTimestampMS(attachment.timestamp) : previousTimestamp;
      stdio.push({
        ...(attachment.contentEncoding === AttachmentContentEncoding.BASE64 ? {
          buffer: attachment.body
        } : {
          text: attachment.body
        }),
        dts: Math.max(0, timestamp - previousTimestamp) as FK.DurationMS,
      });
      previousTimestamp = timestamp;
    }
  }

  return stdio;
}

async function extractAttachmentsFromTestSteps(
  steps: ParsedTestStep[],
  attachments: Map<FK.AttachmentId, ReportDataAttachment>,
): Promise<FK.Attachment[]> {
  const fkAttachments: FK.Attachment[] = [];

  for (const step of steps) {
    for (const attachment of step.attachments) {
      if (attachment.mediaType === CUCUMBER_LOG_MEDIA_TYPE)
        continue;

      const dataAttachment = await ReportUtils.createDataAttachment(
        attachment.mediaType,
        decodeAttachmentBody(attachment),
      );
      attachments.set(dataAttachment.id, dataAttachment);
      fkAttachments.push({
        id: dataAttachment.id,
        name: attachment.fileName ?? `attachment-${fkAttachments.length + 1}`,
        contentType: attachment.mediaType,
      });
    }
  }

  return fkAttachments;
}

function decodeAttachmentBody(attachment: CucumberAttachment): Buffer {
  if (attachment.contentEncoding === AttachmentContentEncoding.BASE64)
    return Buffer.from(attachment.body, 'base64');
  return Buffer.from(attachment.body, 'utf8');
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
