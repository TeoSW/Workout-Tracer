import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'src/domain must not import React.',
            },
            { group: ['@ionic/*'], message: 'src/domain must not import Ionic.' },
            { group: ['dexie', 'dexie-react-hooks'], message: 'src/domain must not import Dexie.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'crypto',
          'btoa',
          'atob',
          'fetch',
        ].map((name) => ({ name, message: 'src/domain must not use browser APIs.' })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'src/domain must not read the clock. Pass dates in.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'src/domain must not read the clock. Pass dates in.',
        },
      ],
    },
  },
);
