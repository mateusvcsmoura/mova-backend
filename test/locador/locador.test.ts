import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { createAccount, uniqueCnpj } from "../helpers";

describe("Locador API", () => {
  let contaId: string;
  let locadorId: string;
  const empresa = "Locadora Teste Principal";
  const cnpj = uniqueCnpj();

  beforeAll(async () => {
    const account = await createAccount("LOCADOR");
    contaId = account.conta.id;
  });

  describe("POST /api/locador", () => {
    it("deve criar um locador", async () => {
      const response = await request(app)
        .post("/api/locador")
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
        .send({ id: contaId, empresa: "Outra Empresa", cnpj });

      expect(response.status).toBe(409);
    });

    it("deve recusar CNPJ com dígitos verificadores inválidos (400)", async () => {
      const conta = await createAccount("LOCADOR");
      const response = await request(app)
        .post("/api/locador")
        .send({ id: conta.conta.id, empresa: "Empresa X", cnpj: "11444777000160" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/locador/all", () => {
    it("deve listar os locadores", async () => {
      const response = await request(app).get("/api/locador/all");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/locador/search", () => {
    it("deve buscar locador por CNPJ", async () => {
      const response = await request(app)
        .get("/api/locador/search")
        .query({ cnpj });

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locadorId);
    });
  });

  describe("GET /api/locador/:id", () => {
    it("deve retornar o locador por id", async () => {
      const response = await request(app).get(`/api/locador/${locadorId}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locadorId);
    });

    it("deve retornar 400 para id inválido", async () => {
      const response = await request(app).get("/api/locador/id-invalido");

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/locador/:id", () => {
    it("deve atualizar o locador", async () => {
      const novaEmpresa = "Locadora Teste Atualizada";
      const response = await request(app)
        .put(`/api/locador/${locadorId}`)
        .send({ empresa: novaEmpresa });

      expect(response.status).toBe(200);
      expect(response.body.result.empresa).toBe(novaEmpresa);
    });
  });

  describe("DELETE /api/locador/:id", () => {
    it("deve remover o locador", async () => {
      const response = await request(app).delete(`/api/locador/${locadorId}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
