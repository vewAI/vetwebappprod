import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["test/setupTests.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.{spec,test}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    clearMocks: true,
    watch: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
