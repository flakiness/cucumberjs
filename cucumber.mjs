export default {
  paths: ['features/**/*.feature'],
  import: ['tsx/esm', 'features/support/**/*.ts'],
  format: ['progress', ['@flakiness/cucumberjs', '.flakiness/cucumber-formatter.log']],
  formatOptions: {
    flakinessProject: 'flakiness/cucumberjs',
  },
  parallel: 0,
};
