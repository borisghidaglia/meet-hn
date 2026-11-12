import nextVitals from "eslint-config-next/core-web-vitals";

// Flat config (Next 16 removed `next lint`); same rules as the old
// .eslintrc.json `extends: "next/core-web-vitals"`.
const config = [
  ...nextVitals,
  {
    // React Compiler checks, new in eslint-config-next 16. Existing code trips
    // them without being broken; kept visible as warnings, to fix separately.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/error-boundaries": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "migrations/**"],
  },
];

export default config;
