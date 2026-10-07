import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { describe, it, expect } from "vitest";

import { app } from "../../src/app";
import { MENSAGENS } from "../../src/i18n/mensagens";

const DINAMICAS_NAO_TRADUZIDAS = [
  "As seguintes placas já estão cadastradas: ${duplicadas.join(\", \")}",
  "Gateway de pagamento desconhecido: ${provider}",
  "O local de ${contexto} não está disponível (garagem inativa ou em manutenção).",
  "Parâmetro '${paramName}' não encontrado na rota",
  'Sandbox de pagamento indisponível: segredo do gateway "${provider}" não configurado.',
];

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivosTs(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );
}

// 2º argumento literal de `new HttpError(status, "...")` (aspas, apóstrofo ou crase).
const HTTP_ERROR_LITERAL = /new HttpError\(\s*[^,()]+?,\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

describe("i18n — catálogo de mensagens de negócio", () => {
  it("toda entrada tem en e es não vazios", () => {
    for (const [pt, t] of Object.entries(MENSAGENS)) {
      expect(t.en.trim(), `en vazio: ${pt}`).not.toBe("");
      expect(t.es.trim(), `es vazio: ${pt}`).not.toBe("");
    }
  });

  it("todo literal de new HttpError( em src/ tem entrada no catálogo", () => {
    const faltando: string[] = [];
    let encontrados = 0;
    for (const arquivo of arquivosTs("src")) {
      for (const m of readFileSync(arquivo, "utf8").matchAll(HTTP_ERROR_LITERAL)) {
        encontrados++;
        const msg = m[2];
        if (m[1] === "`" && msg.includes("${")) {
          if (!DINAMICAS_NAO_TRADUZIDAS.includes(msg)) faltando.push(`${arquivo}: \`${msg}\` (dinâmica)`);
          continue;
        }
        if (!Object.hasOwn(MENSAGENS, msg)) faltando.push(`${arquivo}: ${msg}`);
      }
    }
    expect(encontrados).toBeGreaterThan(100); // sanidade: o regex achou os throws
    expect(faltando).toEqual([]);
  });
});

describe("i18n — erro de negócio via HTTP (login com credenciais inválidas)", () => {
  const login = (lang?: string) => {
    const req = request(app).post("/api/conta/auth/login");
    if (lang) req.set("Accept-Language", lang);
    return req.send({ email: "inexistente-i18n@test.local", senha: "SenhaErrada123!" });
  };

  it.each([
    ["en", "Invalid credentials"],
    ["es", "Credenciales inválidas"],
    ["pt-BR", "Credenciais inválidas"],
    [undefined, "Credenciais inválidas"],
  ])("Accept-Language %s → %s", async (lang, esperado) => {
    const res = await login(lang);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "BUSINESS_ERROR", message: esperado });
  });
});
