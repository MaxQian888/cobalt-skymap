import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTs]),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".worktrees/**",
    ".codex-tmp/**",
    "next-env.d.ts",
    // Stellarium Web Engine (third-party)
    "public/stellarium-js/**",
    // Tauri build artifacts
    "src-tauri/target/**",
    // Playwright generated artifacts
    "playwright-report/**",
    "test-results/**",
    // Touch-N-Stars (reference code)
    "Touch-N-Stars/**",
  ]),
  // Allow unused variables with underscore prefix
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["components/common/log-viewer.tsx"],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
