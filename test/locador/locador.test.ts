import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { Account, createAccount, uniqueCnpj } from "../helpers";

describe("Locador API", () => {
  let contaId: string;
  let locadorId: string;
  let token: string;
  let outroLocador: Account;
  let outroLocadorId: string;
  const empresa = "Locadora Teste Principal";
  const cnpj = uniqueCnpj();

  beforeAll(async () => {
    const account = await createAccount("LOCADOR");
    contaId = account.conta.id;
    token = account.token;
    outroLocador = await createAccount("LOCADOR");
    outroLocadorId = outroLocador.conta.id;
  });

  describe("POST /api/locador", () => {
    it("deve criar um locador", async () => {
      const response = await request(app)
        .post("/api/locador")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: contaId, empresa, cnpj });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result.id).toBe(contaId);
      expect(response.body.result.empresa).toBe(empresa);
      expect(response.body.result.cnpj).toBe(cnpj);

      locadorId = response.body.result.id;
    });

    it("deve recusar locador duplicado (CNPJ existente)", async () => {
      const response = await request(app)
        .post("/api/locador")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: contaId, empresa: "Outra Empresa", cnpj });

      expect(response.status).toBe(409);
    });

    it("deve recusar CNPJ com dígitos verificadores inválidos (400)", async () => {
      const conta = await createAccount("LOCADOR");
      const response = await request(app)
        .post("/api/locador")
        .set("Authorization", `Bearer ${conta.token}`)
        .send({ id: conta.conta.id, empresa: "Empresa X", cnpj: "11444777000160" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/locador/all", () => {
    it("deve listar somente o perfil do locador autenticado", async () => {
      const response = await request(app)
        .get("/api/locador/all")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result).toHaveLength(1);
      expect(response.body.result[0].id).toBe(locadorId);
    });

    it("recusa listagem sem token (401)", async () => {
      const response = await request(app).get("/api/locador/all");
      expect(response.status).toBe(401);
    });

    it("recusa token inválido (401)", async () => {
      const response = await request(app)
        .get("/api/locador/all")
        .set("Authorization", "Bearer token-invalido");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/locador/search", () => {
    it("deve buscar locador por CNPJ", async () => {
      const response = await request(app)
        .get("/api/locador/search")
        .set("Authorization", `Bearer ${token}`)
        .query({ cnpj });

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locadorId);
    });
  });

  describe("GET /api/locador/:id", () => {
    it("deve retornar o locador por id", async () => {
      const response = await request(app)
        .get(`/api/locador/${locadorId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locadorId);
    });

    it("deve retornar 400 para id inválido", async () => {
      const response = await request(app)
        .get("/api/locador/id-invalido")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/locador/:id", () => {
    it("deve atualizar o locador", async () => {
      const novaEmpresa = "Locadora Teste Atualizada";
      const response = await request(app)
        .put(`/api/locador/${locadorId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ id: outroLocadorId, empresa: novaEmpresa });

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locadorId);
      expect(response.body.result.empresa).toBe(novaEmpresa);
    });
  });

  describe("proteção de propriedade", () => {
    beforeAll(async () => {
      const response = await request(app)
        .post("/api/locador")
        .set("Authorization", `Bearer ${outroLocador.token}`)
        .send({
          id: outroLocadorId,
          empresa: "Outra Locadora Teste",
          cnpj: uniqueCnpj(),
        });
      expect(response.status).toBe(201);
    });

    it("bloqueia consulta de outro locador (403)", async () => {
      const response = await request(app)
        .get(`/api/locador/${outroLocadorId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it("bloqueia edição de outro locador e mass assignment (403)", async () => {
      const response = await request(app)
        .put(`/api/locador/${outroLocadorId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ id: contaId, empresa: "Tentativa Indevida" });
      expect(response.status).toBe(403);
    });

    it("bloqueia exclusão de outro locador (403)", async () => {
      const response = await request(app)
        .delete(`/api/locador/${outroLocadorId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it("ignora id enviado no cadastro e vincula perfil à conta autenticada", async () => {
      const conta = await createAccount("LOCADOR");
      const response = await request(app)
        .post("/api/locador")
        .set("Authorization", `Bearer ${conta.token}`)
        .send({
          id: outroLocadorId,
          empresa: "Locadora Vinculo Confiavel",
          cnpj: uniqueCnpj(),
        });

      expect(response.status).toBe(201);
      expect(response.body.result.id).toBe(conta.conta.id);
    });
  });

  describe("DELETE /api/locador/:id", () => {
    it("deve remover o locador", async () => {
      const response = await request(app)
        .delete(`/api/locador/${locadorId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
