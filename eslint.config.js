import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
    },
    settings: { react: { version: 'detect' } },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
  },
  {
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
]
