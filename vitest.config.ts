import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [...configDefaults.exclude, "./app/_tests/playwright/*"],
    environment: "jsdom",
    alias: {
      "@/": new URL("./", import.meta.url).pathname,
    },
  },
});
