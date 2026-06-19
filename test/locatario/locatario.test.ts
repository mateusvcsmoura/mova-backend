import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { createAccount, uniqueCpf, uniqueCnh } from "../helpers";

describe("Locatario API", () => {
  let contaId: string;
  let locatarioId: string;
  const cpf = uniqueCpf();
  const cnh = uniqueCnh();

  beforeAll(async () => {
    const account = await createAccount("LOCATARIO");
    contaId = account.conta.id;
  });

  describe("POST /api/locatario", () => {
    it("deve criar um locatário", async () => {
      const response = await request(app)
        .post("/api/locatario")
        .send({ id: contaId, cpf, cnh });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result.id).toBe(contaId);
      expect(response.body.result.cpf).toBe(cpf);
      expect(response.body.result.cnh).toBe(cnh);

      locatarioId = response.body.result.id;
    });

    it("deve recusar locatário duplicado (CPF existente)", async () => {
      const response = await request(app)
        .post("/api/locatario")
        .send({ id: contaId, cpf, cnh: uniqueCnh() });

      expect(response.status).toBe(409);
    });
  });

  describe("GET /api/locatario/all", () => {
    it("deve listar os locatários", async () => {
      const response = await request(app).get("/api/locatario/all");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/locatario/search", () => {
    it("deve buscar locatário por CPF", async () => {
      const response = await request(app)
        .get("/api/locatario/search")
        .query({ cpf });

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locatarioId);
    });
  });

  describe("GET /api/locatario/:id", () => {
    it("deve retornar o locatário por id", async () => {
      const response = await request(app).get(`/api/locatario/${locatarioId}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(locatarioId);
    });

    it("deve retornar 400 para id inválido", async () => {
      const response = await request(app).get("/api/locatario/id-invalido");

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/locatario/:id", () => {
    it("deve atualizar o locatário", async () => {
      const novoCnh = uniqueCnh();
      const response = await request(app)
        .put(`/api/locatario/${locatarioId}`)
        .send({ cnh: novoCnh });

      expect(response.status).toBe(200);
      expect(response.body.result.cnh).toBe(novoCnh);
    });
  });

  describe("DELETE /api/locatario/:id", () => {
    it("deve remover o locatário", async () => {
      const response = await request(app).delete(
        `/api/locatario/${locatarioId}`,
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
