import { defineConfig } from "vitest/config";

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
      ? ["default", "junit", ["allure-vitest/reporter", { resultsDir: "allure-results" }]]
      : ["default", "junit"],
    exclude: ["dist/**", "node_modules", ".worktrees/**"],
    fileParallelism: false,
    maxWorkers: 1,
    // Worker forks encerram inesperadamente no Windows após testes de
    // concorrência PostgreSQL; threads preserva execução serial estável.
    pool: "threads",
    // 30s (era 20s): há cenários de concorrência contra o Postgres local que
    // ultrapassam 20s em Windows. Não muda regra de negócio.
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
