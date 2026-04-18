export default {
  paths: ['features/**/*.feature'],
  import: ['tsx/esm', 'features/support/**/*.ts'],
  format: ['progress', ['@flakiness/cucumberjs', 'flakiness.log']],
  formatOptions: {
    flakinessProject: 'flakiness/cucumberjs',
  },
  parallel: 0,
};
