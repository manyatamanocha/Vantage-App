import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Scoped to test files: the underscore-prefixed-unused convention this
    // enables (e.g. an intentionally-unused mock argument) is a test-file
    // pattern, not a repo-wide one. Scoping here — rather than overriding
    // `@typescript-eslint/no-unused-vars` for every file — avoids silently
    // replacing whatever options Next's config (or a future repo-wide
    // change) sets for that rule elsewhere.
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
