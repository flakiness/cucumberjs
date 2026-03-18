export default {
  paths: ['features/**/*.feature'],
  import: ['tsx/esm', 'features/support/**/*.ts'],
  format: ['@cucumber/pretty-formatter'],
  parallel: 0,
};
