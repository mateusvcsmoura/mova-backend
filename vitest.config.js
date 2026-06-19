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
  },
});
