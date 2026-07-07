import { defineConfig } from "vitest/config";
import { allureVitest } from "allure-vitest";

export default defineConfig({
  plugins: [allureVitest()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./test/setup.ts",
    exclude: ["dist/**", "node_modules"],
    fileParallelism: false,
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/server.ts", "src/routes/container.ts"],
    },
    reporters: ["default", "junit", "allure-vitest"],
    outputFile: {
      junit: "./reports/vitest.xml",
    }
  },
});
