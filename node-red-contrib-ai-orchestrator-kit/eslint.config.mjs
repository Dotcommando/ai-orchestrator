import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import stylistic from '@stylistic/eslint-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  { ignores: ['dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
        project: path.join(__dirname, 'tsconfig.json'),
        tsconfigRootDir: __dirname
      },
      globals: {
        console: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'simple-import-sort': simpleImportSort,
      '@stylistic': stylistic
    },
    rules: {
      'padding-line-between-statements': 'off',
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'never', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'switch', 'try', 'do'] },
        { blankLine: 'always', prev: 'if', next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'never', prev: 'if', next: 'if' }
      ],
      'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-infix-ops': 'error',
      'space-before-blocks': ['error', 'always'],
      'no-multi-spaces': 'error',
      quotes: ['error', 'single', { avoidEscape: true }],
      'max-len': 'off',
      '@stylistic/operator-linebreak': [
        'error',
        'before',
        {
          overrides: {
            '=': 'none',
            '?': 'before',
            ':': 'before',
            '&&': 'before',
            '||': 'before'
          }
        }
      ],
      '@typescript-eslint/prefer-optional-chain': ['error', { allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing: true }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      ...tsPlugin.configs['recommended'].rules
    }
  }
];
