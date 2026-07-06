import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect } from "vitest";
import { createAccount, uniqueEmail } from "../helpers";

describe("Conta API", () => {
  const data = {
    nome: "Jarvan IV",
    email: "jarvan.iv@lol.com",
    senha: "StrongPassword#123",
    telefone: "11987654321",
    cargo: "LOCATARIO",
    cep: "12345-678",
    endereco: "Rua dos Campeões, 123",
  };
  let token: string;

  describe("POST /auth/register", () => {
    it("deve criar um usuário", async () => {
      const response = await request(app)
        .post("/api/conta/auth/register")
        .send(data);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("result");
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("conta");
      expect(response.body.result).toHaveProperty("token");
      expect(response.body.result.conta).toHaveProperty("id");
      expect(response.body.result.conta.email).toBe("jarvan.iv@lol.com");
      expect(response.body.result.conta).toHaveProperty("criadaEm");
      expect(response.body.result.conta).not.toHaveProperty("senhaHash");
    });

    it("deve recusar senha fraca (400)", async () => {
      const response = await request(app)
        .post("/api/conta/auth/register")
        .send({ ...data, email: uniqueEmail("fraca"), senha: "fraca123" });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("deve autenticar um usuário", async () => {
      const response = await request(app)
        .post("/api/conta/auth/login")
        .send({ email: data.email, senha: data.senha });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("token");

      token = response.body.result.token;
    });
  });

  describe("GET /auth/me", () => {
    it("deve retornar os dados do usuário autenticado", async () => {
      const response = await request(app)
        .get("/api/conta/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("conta");
      expect(response.body.result.conta).toHaveProperty("id");
      expect(response.body.result.conta.nome).toBe(data.nome);
      expect(response.body.result.conta.email).toBe(data.email);
      expect(response.body.result.conta.telefone).toBe(data.telefone);
      expect(response.body.result.conta.cargo).toBe(data.cargo);
      expect(response.body.result.conta.cep).toBe(data.cep);
      expect(response.body.result.conta.endereco).toBe(data.endereco);
      expect(response.body.result.conta).toHaveProperty("criadaEm");
      expect(response.body.result.conta).not.toHaveProperty("senhaHash");
    });
  });

  describe("PUT auth/update-profile", () => {
    it("deve atualizar os dados do usuário autenticado", async () => {
      const updatedData = {
        nome: "Jarvan IV - Updated",
        telefone: "11999999999",
        cep: "98765-432",
        endereco: "Avenida dos Campeões, 456",
      };

      const response = await request(app)
        .put("/api/conta/auth/update-profile")
        .set("Authorization", `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("conta");
      expect(response.body.result.conta).toHaveProperty("id");
      expect(response.body.result.conta.nome).toBe(updatedData.nome);
      expect(response.body.result.conta.email).toBe(data.email);
      expect(response.body.result.conta.telefone).toBe(updatedData.telefone);
      expect(response.body.result.conta.cargo).toBe(data.cargo);
      expect(response.body.result.conta.cep).toBe(updatedData.cep);
      expect(response.body.result.conta.endereco).toBe(updatedData.endereco);
      expect(response.body.result.conta).toHaveProperty("criadaEm");
      expect(response.body.result.conta).not.toHaveProperty("senhaHash");
    });

    it("deve recusar troca para e-mail já em uso (409)", async () => {
      const outra = await createAccount("LOCATARIO");

      const response = await request(app)
        .put("/api/conta/auth/update-profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: outra.email });

      expect(response.status).toBe(409);
    });
  });

  describe("PATCH auth/change-password", () => {
    const passwordData = {
      senhaAtual: data.senha,
      novaSenha: "NewStrongPassword#456",
    };

    it("deve alterar a senha do usuário autenticado", async () => {
      const response = await request(app)
        .patch("/api/conta/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send(passwordData);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it("deve autenticar com a nova senha", async () => {
      const response = await request(app)
        .post("/api/conta/auth/login")
        .send({ email: data.email, senha: passwordData.novaSenha });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("token");
    });
  });

  describe("DELETE /auth/delete-account", () => {
    it("deve deletar a conta do usuário autenticado", async () => {
      const response = await request(app)
        .delete("/api/conta/auth/delete-account")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
