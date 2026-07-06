import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createAccount,
  uniqueEmail,
  DEFAULT_SENHA,
  type Account,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Admin API (Conta)", () => {
  let admin: Account;
  let locatario: Account;
  let contaId: string;
  const email = uniqueEmail("admin-conta");

  beforeAll(async () => {
    admin = await createAccount("ADMIN");
    locatario = await createAccount("LOCATARIO");
  });

  describe("Autorização das rotas administrativas", () => {
    it("deve recusar acesso sem autenticação (401)", async () => {
      const response = await request(app).get("/api/admin/conta/all");
      expect(response.status).toBe(401);
    });

    it("deve recusar acesso de não-ADMIN (403)", async () => {
      const response = await request(app)
        .get("/api/admin/conta/all")
        .set(auth(locatario.token));
      expect(response.status).toBe(403);
    });

    it("deve recusar criação de conta por não-ADMIN (403)", async () => {
      const response = await request(app)
        .post("/api/admin/conta/create")
        .set(auth(locatario.token))
        .send({
          nome: "Hacker",
          email: uniqueEmail("hack"),
          senha: DEFAULT_SENHA,
          cep: "12345-678",
          endereco: "Rua X, 1",
          cargo: "ADMIN",
        });
      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/admin/conta/create", () => {
    it("deve criar uma conta (ADMIN)", async () => {
      const response = await request(app)
        .post("/api/admin/conta/create")
        .set(auth(admin.token))
        .send({
          nome: "Conta Admin Teste",
          email,
          senha: DEFAULT_SENHA,
          cep: "12345-678",
          endereco: "Rua Admin, 100",
          cargo: "LOCATARIO",
        });

      expect(response.status).toBe(201);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.email).toBe(email);

      contaId = response.body.result.id;
    });
  });

  describe("GET /api/admin/conta/all", () => {
    it("deve listar as contas (ADMIN)", async () => {
      const response = await request(app)
        .get("/api/admin/conta/all")
        .set(auth(admin.token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
    });
  });

  describe("GET /api/admin/conta (por email)", () => {
    it("deve buscar a conta por email (ADMIN)", async () => {
      const response = await request(app)
        .get("/api/admin/conta")
        .set(auth(admin.token))
        .query({ email });

      expect(response.status).toBe(200);
      expect(response.body.result.email).toBe(email);
    });
  });

  describe("GET /api/admin/conta/:id", () => {
    it("deve retornar a conta por id (ADMIN)", async () => {
      const response = await request(app)
        .get(`/api/admin/conta/${contaId}`)
        .set(auth(admin.token));

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(contaId);
    });
  });

  describe("PUT /api/admin/conta/update/:id", () => {
    it("deve atualizar a conta (ADMIN)", async () => {
      const response = await request(app)
        .put(`/api/admin/conta/update/${contaId}`)
        .set(auth(admin.token))
        .send({ nome: "Conta Admin Atualizada" });

      expect(response.status).toBe(200);
      expect(response.body.result.nome).toBe("Conta Admin Atualizada");
    });
  });

  describe("DELETE /api/admin/conta/delete/:id", () => {
    it("deve remover a conta (ADMIN)", async () => {
      const response = await request(app)
        .delete(`/api/admin/conta/delete/${contaId}`)
        .set(auth(admin.token));

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
