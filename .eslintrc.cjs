module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ["eslint:recommended", "plugin:react/recommended"],
  plugins: ["react", "unused-imports"],
  parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
  rules: {
    "react/prop-types": "off",
    "no-debugger": "error",
    "no-console": ["error", { allow: ["warn", "error"] }],
    "unused-imports/no-unused-imports": "error",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  },
  settings: { react: { version: "detect" } },
  overrides: [
    { files: ["**/*.test.*","**/*.spec.*","**/*.stories.*"], rules: { "no-console": "off" } }
  ]
};
