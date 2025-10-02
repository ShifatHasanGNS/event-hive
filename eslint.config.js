const js = require('@eslint/js');
const globals = require('globals');

const sharedRules = {
  ...js.configs.recommended.rules,
  'no-console': 'off',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', args: 'after-used', vars: 'all' }],
};

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/assets/**'],
  },
  {
    ...js.configs.recommended,
    files: ['src/**/*.js', 'api/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: sharedRules,
  },
  {
    ...js.configs.recommended,
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: sharedRules,
  },
];
