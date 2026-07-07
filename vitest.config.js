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
  },
});
