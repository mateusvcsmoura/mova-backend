import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["allure-vitest/setup", "./test/setup.ts"],
    reporters: [
      "default",
      "junit",
      ["allure-vitest/reporter", { resultsDir: "allure-results" }],
    ],
    exclude: ["dist/**", "node_modules"],
    fileParallelism: false,
    // 30s (era 20s): a suite roda contra Postgres remoto (Supabase) e o teste
    // dos tres gateways de pagamento encostava no limite (18,6s medidos), falhando
    // de forma intermitente. Nao muda regra de negocio.
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
