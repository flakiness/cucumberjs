import type { IFormatterOptions } from '@cucumber/cucumber';
import { Formatter } from '@cucumber/cucumber';
import type { Envelope } from '@cucumber/messages';
import { FlakinessReport as FK } from '@flakiness/flakiness-report';
import {
  CIUtils,
  CPUUtilization,
  GitWorktree,
  RAMUtilization,
  ReportUtils,
  showReport,
  uploadReport,
  writeReport,
} from '@flakiness/sdk';
import path from 'node:path';

type OpenMode = 'always' | 'never' | 'on-failure';

type FormatterConfig = {
  disableUpload?: boolean,
  endpoint?: string,
  flakinessProject?: string,
  open?: OpenMode,
  outputFolder?: string,
  token?: string,
};

export default class FlakinessCucumberFormatter extends Formatter {
  static documentation = 'Generates a Flakiness report for a CucumberJS run.';

  private _config: FormatterConfig;
  private _cpuUtilization = new CPUUtilization({ precision: 10 });
  private _ramUtilization = new RAMUtilization({ precision: 10 });
  private _startTimestamp = Date.now() as FK.UnixTimestampMS;
  private _outputFolder: string;
  private _finalizePromise?: Promise<void>;
  private _telemetryTimer?: NodeJS.Timeout;

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
        this._startTimestamp = Date.now() as FK.UnixTimestampMS;
      if (!envelope.testRunFinished || this._finalizePromise)
        return;
      this._finalizePromise = this._onTestRunFinished().catch(error => {
        console.error(`[flakiness.io] Failed to generate report: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      });
    });
  }

  override async finished(): Promise<void> {
    if (this._telemetryTimer)
      clearTimeout(this._telemetryTimer);
    await this._finalizePromise;
    
    await super.finished();
  }

  private _sampleSystem(): void {
    this._cpuUtilization.sample();
    this._ramUtilization.sample();
    this._telemetryTimer = setTimeout(this._sampleSystem, 1000);
  }

  private async _onTestRunFinished(): Promise<void> {
    if (this._telemetryTimer)
      clearTimeout(this._telemetryTimer);
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

    const duration = (Date.now() - this._startTimestamp) as FK.DurationMS;
    const report = ReportUtils.normalizeReport({
      category: 'cucumberjs',
      commitId,
      duration,
      environments: [
        ReportUtils.createEnvironment({
          name: 'cucumberjs',
        }),
      ],
      flakinessProject: this._config.flakinessProject,
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

    const openMode = this._config.open ?? 'on-failure';
    const shouldOpen = process.stdin.isTTY && !process.env.CI && openMode === 'always';
    if (shouldOpen) {
      await showReport(this._outputFolder);
      return;
    }

    const defaultOutputFolder = path.join(this.cwd, 'flakiness-report');
    const folder = defaultOutputFolder === this._outputFolder ? '' : path.relative(this.cwd, this._outputFolder);
    this.log(`
To open last Flakiness report, run:

  npx flakiness show ${folder}
`);
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
    open: isOpenMode(parsedArgvOptions.open) ? parsedArgvOptions.open : undefined,
    outputFolder: typeof parsedArgvOptions.outputFolder === 'string' ? parsedArgvOptions.outputFolder : undefined,
    token: typeof parsedArgvOptions.token === 'string' ? parsedArgvOptions.token : undefined,
  };
}

function isOpenMode(value: unknown): value is OpenMode {
  return value === 'always' || value === 'never' || value === 'on-failure';
}
