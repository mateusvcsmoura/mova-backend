import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { grupoDoArquivo, organizarSuites } from "../allure-suites";

const PASTA_TEST = fileURLToPath(new URL("..", import.meta.url));

describe("Allure — agrupamento das suítes", () => {
  it("todo arquivo de teste tem grupo (ator, entidade ou segmento)", () => {
    const arquivos = readdirSync(PASTA_TEST, { recursive: true })
      .map((p) => String(p).replaceAll("\\", "/"))
      .filter((p) => p.endsWith(".test.ts"));

    expect(arquivos.length).toBeGreaterThan(70);
    expect(arquivos.filter((a) => !grupoDoArquivo(`test/${a}`))).toEqual([]);
  });

  it("arquivo exato vence a pasta", () => {
    expect(grupoDoArquivo("test/reserva/reserva.test.ts")).toBe("Entidade: Reserva");
    expect(grupoDoArquivo("test/reserva/rastreamento-locatario.test.ts")).toBe("Entidade: Localização");
    expect(grupoDoArquivo("test/security/jwt.test.ts")).toBe("Segmento: Autenticação e segurança");
    expect(grupoDoArquivo("test/security/cargo-privilege.test.ts")).toBe("Entidade: Conta");
  });

  it("grupo vira parentSuite e os describes descem um nível", () => {
    const resultado = {
      titlePath: ["mova-backend", "test", "garagem", "garagem.test.ts", "Garagem API", "capacidade", "lotação"],
      labels: [
        { name: "parentSuite", value: "Garagem API" },
        { name: "suite", value: "capacidade" },
        { name: "subSuite", value: "lotação" },
        { name: "package", value: "mova-backend.test.garagem.garagem.test.ts" },
      ],
    };

    organizarSuites(resultado);

    expect(resultado.labels).toEqual([
      { name: "package", value: "mova-backend.test.garagem.garagem.test.ts" },
      { name: "parentSuite", value: "Entidade: Garagem" },
      { name: "suite", value: "Garagem API" },
      { name: "subSuite", value: "capacidade > lotação" },
    ]);
  });
});
