import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import {
  DEFAULT_SENHA,
  createAccount,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

describe("LGPD", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let admin: Account;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    admin = await createAccount("ADMIN");
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    await createReserva(locatario.token, veiculo.id, locatario.locatarioId);
  });

  describe("Exportação (portabilidade)", () => {
    it("titular exporta os próprios dados, sem senhaHash", async () => {
      const res = await request(app)
        .get("/api/lgpd/meus-dados")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.conta.email).toBe(locatario.email);
      expect(res.body.result.conta).not.toHaveProperty("senhaHash");
      expect(res.body.result.locatario.cpf).toBe(locatario.cpf);
      expect(res.body.result.reservas.length).toBeGreaterThanOrEqual(1);
    });

    it("recusa exportar dados de outro titular (não-admin) → 403", async () => {
      const res = await request(app)
        .get(`/api/lgpd/${locador.locadorId}/dados`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(403);
    });

    it("ADMIN exporta dados de qualquer titular", async () => {
      const res = await request(app)
        .get(`/api/lgpd/${locatario.locatarioId}/dados`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.conta.id).toBe(locatario.locatarioId);
    });
  });

  describe("Anonimização (direito ao esquecimento)", () => {
    it("anonimiza o PII, mantém a conta e invalida o login", async () => {
      const alvo = await createLocatario();
      const senhaAntiga = DEFAULT_SENHA;
      const emailAntigo = alvo.email;

      const res = await request(app)
        .post("/api/lgpd/anonimizar")
        .set("Authorization", `Bearer ${alvo.token}`);
      expect(res.status).toBe(200);
      expect(res.body.result.anonimizado).toBe(true);

      // Login com as credenciais antigas não funciona mais.
      const login = await request(app)
        .post("/api/conta/auth/login")
        .send({ email: emailAntigo, senha: senhaAntiga });
      expect(login.status).not.toBe(200);

      // A conta continua existindo, agora anonimizada.
      const dados = await request(app)
        .get(`/api/lgpd/${alvo.locatarioId}/dados`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(dados.status).toBe(200);
      expect(dados.body.result.conta.nome).toBe("Usuário anonimizado");
      expect(dados.body.result.conta.anonimizadoEm).not.toBeNull();
      expect(dados.body.result.locatario.rg).toBe("[removido]");
    });
  });

  describe("Auditoria de acesso", () => {
    it("registra EXPORTAR e ANONIMIZAR na trilha do titular", async () => {
      const alvo = await createLocatario();

      await request(app)
        .get("/api/lgpd/meus-dados")
        .set("Authorization", `Bearer ${alvo.token}`);
      await request(app)
        .post("/api/lgpd/anonimizar")
        .set("Authorization", `Bearer ${alvo.token}`);

      const res = await request(app)
        .get(`/api/lgpd/${alvo.locatarioId}/acessos`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      const acoes = res.body.result.map((a: { acao: string }) => a.acao);
      expect(acoes).toContain("EXPORTAR");
      expect(acoes).toContain("ANONIMIZAR");
    });
  });
});
