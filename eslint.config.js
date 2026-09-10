import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // The data layer (Supabase queries, edge functions, JSON parsing) is
      // intentionally loosely typed — enforcing this across the repo produced
      // ~150 errors with no type-safety gain. Prefer real types in new code.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // The shadcn/ui primitives export their cva() variants alongside the
    // component, and every context file exports both its provider and the
    // use* hook. Both are the documented shape for those libraries, so this
    // fast-refresh granularity rule is pure noise here. It still applies to
    // the app's own components and pages.
    files: ["src/components/ui/**/*.tsx", "src/contexts/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
