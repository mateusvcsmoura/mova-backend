import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect } from "vitest";

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
      expect(response.body.success).toBeTruthy();
      expect(response.body.result).toHaveProperty("conta");
      expect(response.body.result).toHaveProperty("token");
      expect(response.body.result.conta).toHaveProperty("id");
      expect(response.body.result.conta.email).toBe("jarvan.iv@lol.com");
      expect(response.body.result.conta).toHaveProperty("criadaEm");
      expect(response.body.result.conta).not.toHaveProperty("senhaHash");

      token = response.body.result.token;
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
    });
  });
});
