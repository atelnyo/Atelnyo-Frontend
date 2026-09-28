/**
 * eslint.config.js — ESLint flat config (v9+ / v10).
 *
 * Designed for Atelnyo Academy's React + Vite frontend.
 *
 * Plugins:
 *   eslint-plugin-react           — React-specific linting rules
 *   eslint-plugin-react-hooks     — Rules of Hooks enforcement
 *   eslint-plugin-react-refresh   — HMR / Fast Refresh compat
 *
 * Usage:
 *   npx eslint src/
 *   npx eslint src/ --fix
 *
 * Add to package.json scripts:
 *   "lint": "eslint src/",
 *   "lint:fix": "eslint src/ --fix"
 */

import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import globals from 'globals';
import noFunctionInDeps from './eslint-rules/no-function-in-deps.js';

export default [
  // ─── Global ignore patterns ─────────────────────────────────────
  {
    ignores: [
      'dist/',
      'node_modules/',
      'public/',
      '*.config.*',
      'e2e/',
    ],
  },

  // ─── Source files ────────────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],

    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
      'custom': { rules: { 'no-function-in-deps': noFunctionInDeps } },
    },

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Remove Node.js-specific globals that may conflict
        process: 'off',
        __dirname: 'off',
        __filename: 'off',
        global: 'off',
        module: 'off',
        require: 'off',
        Buffer: 'off',
      },
    },

    settings: {
      react: {
        version: 'detect',     // Auto-detect React version from package.json
      },
    },

    rules: {
      // ── Recommended sets ──────────────────────────────────────
      ...reactPlugin.configs.recommended.rules,

      // ── React ─────────────────────────────────────────────────
      'react/react-in-jsx-scope': 'off',        // React 18+ auto JSX transform
      'react/prop-types': 'warn',               // Encourage but don't enforce prop types
      'react/display-name': 'off',              // OK for anonymous function components
      'react/jsx-no-target-blank': 'error',     // Require rel="noreferrer" with target="_blank"
      'react/no-unescaped-entities': 'warn',    // Warn on unescaped quotes in JSX
      'react/jsx-key': 'warn',                  // Warn on missing key in iterators
      'react/jsx-no-duplicate-props': 'error',  // Duplicate props → error
      'react/self-closing-comp': 'warn',        // <Component></Component> → <Component />
      'react/jsx-boolean-value': 'warn',        // <Prop={true}> → <Prop>
      'react/no-array-index-key': 'warn',       // Avoid index as key in lists

      // ── React Hooks ──────────────────────────────────────────
      ...reactHooksPlugin.configs.recommended.rules,

      // ── React Refresh (Vite HMR) ─────────────────────────────
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['metadata', 'loader'] },
      ],

      // ── General JS ───────────────────────────────────────────
      'no-undef': 'error',                      // Catch undefined variables
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],  // Allow console.warn/error
      'prefer-const': 'warn',                   // let → const when never reassigned
      'no-var': 'error',                        // var → let/const
      'eqeqeq': ['warn', 'smart'],              // === with smart exceptions
      'curly': 'warn',                          // Require curly braces
      'no-throw-literal': 'error',              // throw Error(), not throw 'string'
      'no-unused-expressions': 'warn',          // No side-effect-free expressions
      'default-case': 'warn',                   // Require default in switch
      'no-useless-return': 'warn',              // Remove redundant returns
      'object-shorthand': 'warn',               // {value} → {value} or {key:value} → {key}

      // ── Custom: prevent functions in hook dependency arrays ──
      'custom/no-function-in-deps': 'warn',    // const t = () => {}; useCallback(…, [t]) → warn
    },
  },
];
