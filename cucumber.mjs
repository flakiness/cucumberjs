export default {
  paths: ['features/**/*.feature'],
  import: ['tsx/esm', 'features/support/**/*.ts'],
  format: ['@flakiness/cucumberjs', 'progress'],
  formatOptions: {
    flakinessProject: 'flakiness/cucumberjs',
  },
  parallel: 0,
};
