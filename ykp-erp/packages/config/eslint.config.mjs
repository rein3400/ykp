import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * @ykp/config/eslint.config.mjs
 * Base flat ESLint config for YKP ERP apps and packages.
 * Extend or import this config in app-level eslint.config.mjs files.
 */
export default [
  // Ignore common build/output directories
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/build/**", "**/out/**"],
  },

  // Base JavaScript rules from eslint:recommended
  js.configs.recommended,

  // TypeScript configuration
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: true,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        React: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs["recommended-type-checked"].rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
    },
  },

  // Next.js + React configuration
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      next: nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Allow default exports in config/routing files
  {
    files: ["**/{next,eslint,tailwind,postcss}.config.*", "**/app/**/page.tsx", "**/app/**/layout.tsx"],
    rules: {
      "import/no-default-export": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
];
