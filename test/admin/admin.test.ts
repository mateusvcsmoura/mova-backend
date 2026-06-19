import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect } from "vitest";
import { uniqueEmail, DEFAULT_SENHA } from "../helpers";

describe("Admin API (Conta)", () => {
  let contaId: string;
  const email = uniqueEmail("admin-conta");

  describe("POST /api/admin/conta/create", () => {
    it("deve criar uma conta", async () => {
      const response = await request(app)
        .post("/api/admin/conta/create")
        .send({
          nome: "Conta Admin Teste",
          email,
          senha: DEFAULT_SENHA,
          cep: "12345-678",
          endereco: "Rua Admin, 100",
          cargo: "LOCATARIO",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.email).toBe(email);

      contaId = response.body.result.id;
    });
  });

  describe("GET /api/admin/conta/all", () => {
    it("deve listar as contas", async () => {
      const response = await request(app).get("/api/admin/conta/all");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
    });
  });

  describe("GET /api/admin/conta (por email)", () => {
    it("deve buscar a conta por email", async () => {
      const response = await request(app)
        .get("/api/admin/conta")
        .query({ email });

      expect(response.status).toBe(200);
      expect(response.body.result.email).toBe(email);
    });
  });

  describe("GET /api/admin/conta/:id", () => {
    it("deve retornar a conta por id", async () => {
      const response = await request(app).get(`/api/admin/conta/${contaId}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(contaId);
    });
  });

  describe("PUT /api/admin/conta/update/:id", () => {
    it("deve atualizar a conta", async () => {
      const response = await request(app)
        .put(`/api/admin/conta/update/${contaId}`)
        .send({ nome: "Conta Admin Atualizada" });

      expect(response.status).toBe(200);
      expect(response.body.result.nome).toBe("Conta Admin Atualizada");
    });
  });

  describe("DELETE /api/admin/conta/delete/:id", () => {
    it("deve remover a conta", async () => {
      const response = await request(app).delete(
        `/api/admin/conta/delete/${contaId}`,
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
