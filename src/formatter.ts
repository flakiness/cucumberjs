import { Formatter } from '@cucumber/cucumber';
import type { IFormatterOptions } from '@cucumber/cucumber';

type Envelope = {
  testRunFinished?: unknown,
};

export default class FlakinessCucumberFormatter extends Formatter {
  static documentation = 'Minimal formatter used to smoke-test Cucumber integration.';

  constructor(options: IFormatterOptions) {
    super(options);

    options.eventBroadcaster.on('envelope', (envelope: Envelope) => {
      if (!envelope.testRunFinished)
        return;

      const attempts = this.eventDataCollector.getTestCaseAttempts();
      const names = attempts.map(attempt => attempt.pickle.name).join(', ');
      const suffix = names ? ` [${names}]` : '';
      this.log(`[fk-cucumber] minimal formatter finished ${attempts.length} scenario(s)${suffix}\n`);
    });
  }
}
