import { defineConfig } from "vitest/config";
import { organizarSuites } from "./test/allure-suites";

const useAllure = process.env.MOVA_VITEST_ALLURE === "1";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [
      ...(useAllure ? ["allure-vitest/setup"] : []),
      "./test/setup.ts",
    ],
    reporters: useAllure
      ? ["default", "junit", ["allure-vitest/reporter", { resultsDir: "allure-results", listeners: [{ beforeTestResultWrite: organizarSuites }] }]]
      : ["default", "junit"],
    exclude: ["dist/**", "node_modules", ".worktrees/**"],
    fileParallelism: false,
    maxWorkers: 1,
    pool: "threads",
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/server.ts", "src/routes/container.ts"],
    },
    outputFile: {
      junit: "./reports/vitest.xml",
    }
  },
});
