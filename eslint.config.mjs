import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/__tests__/**"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["recommended"].rules,
      ...eslintConfigPrettier.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "no-console": "off",
    },
  },
  {
    files: ["src/**/__tests__/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["recommended"].rules,
      ...eslintConfigPrettier.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "packages/**", "e2e/**"],
  },
];
