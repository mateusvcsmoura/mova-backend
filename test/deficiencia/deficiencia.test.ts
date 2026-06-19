import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { createAccount } from "../helpers";

describe("Deficiencia API", () => {
  let adminToken: string;
  let deficienciaId: string;
  const descricao = "Mobilidade reduzida (teste)";

  beforeAll(async () => {
    const admin = await createAccount("ADMIN");
    adminToken = admin.token;
  });

  describe("POST /api/deficiencia", () => {
    it("deve criar uma deficiência (ADMIN)", async () => {
      const response = await request(app)
        .post("/api/deficiencia")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ descricao });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.descricao).toBe(descricao);

      deficienciaId = response.body.result.id;
    });

    it("deve recusar criação sem autenticação", async () => {
      const response = await request(app)
        .post("/api/deficiencia")
        .send({ descricao: "Sem token" });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/deficiencia/all", () => {
    it("deve listar as deficiências", async () => {
      const response = await request(app).get("/api/deficiencia/all");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
    });
  });

  describe("GET /api/deficiencia/search", () => {
    it("deve buscar deficiência por descrição", async () => {
      const response = await request(app)
        .get("/api/deficiencia/search")
        .query({ descricao });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id", deficienciaId);
    });
  });

  describe("GET /api/deficiencia/:id", () => {
    it("deve retornar a deficiência por id", async () => {
      const response = await request(app).get(
        `/api/deficiencia/${deficienciaId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(deficienciaId);
    });

    it("deve retornar 400 para id inválido", async () => {
      const response = await request(app).get("/api/deficiencia/id-invalido");

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/deficiencia/:id", () => {
    it("deve atualizar a deficiência (ADMIN)", async () => {
      const novaDescricao = "Mobilidade reduzida (editada)";
      const response = await request(app)
        .put(`/api/deficiencia/${deficienciaId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ descricao: novaDescricao });

      expect(response.status).toBe(200);
      expect(response.body.result.descricao).toBe(novaDescricao);
    });
  });

  describe("DELETE /api/deficiencia/:id", () => {
    it("deve remover a deficiência (ADMIN)", async () => {
      const response = await request(app)
        .delete(`/api/deficiencia/${deficienciaId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
