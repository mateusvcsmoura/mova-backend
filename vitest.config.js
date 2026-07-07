import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./test/setup.ts",
    exclude: ["dist/**", "node_modules"],
    // Os arquivos de teste compartilham um único banco e cada um limpa o
    // estado no beforeAll (setup.ts). Rodar em série evita corridas entre eles.
    fileParallelism: false,
    // Suíte de integração: muitos round trips supertest->DB por teste. Sob
    // latência de banco alta o default de 5s estoura em testes pesados
    // (bloqueio "múltiplos bloqueios", reserva "expirar código"). 20s dá folga
    // sem mascarar travas reais.
    testTimeout: 20_000,
    // Cobertura (npm run test:coverage). v8 é nativo, sem instrumentação extra.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      // Tipos, ponto de entrada e o container de DI (só fiação) não agregam
      // sinal de cobertura útil.
      exclude: ["src/**/*.d.ts", "src/server.ts", "src/routes/container.ts"],
    },
  },
});
