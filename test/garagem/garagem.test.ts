import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { createLocador, createVeiculo, type LocadorContext } from "../helpers";

describe("Garagem API", () => {
  let locador: LocadorContext;
  let garagemId: string;
  let veiculoId: string;

  beforeAll(async () => {
    locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
  });

  describe("POST /api/garagem", () => {
    it("deve criar uma garagem (LOCADOR responsável)", async () => {
      const response = await request(app)
        .post("/api/garagem")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({
          idLocador: locador.locadorId,
          nome: "Garagem Central",
          endereco: "Avenida das Garagens, 500",
          capacidade: 10,
          acessibilidade: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.idLocador).toBe(locador.locadorId);
      expect(response.body.result.nome).toBe("Garagem Central");
      expect(response.body.result.status).toBe("ATIVA");

      garagemId = response.body.result.id;
    });

    it("deve recusar criação sem autenticação", async () => {
      const response = await request(app)
        .post("/api/garagem")
        .send({
          idLocador: locador.locadorId,
          nome: "Sem token",
          endereco: "Rua X, 1",
          capacidade: 5,
        });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/garagem", () => {
    it("deve listar as garagens do locador", async () => {
      const response = await request(app)
        .get("/api/garagem")
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });
  });

  describe("GET /api/garagem/:id", () => {
    it("deve retornar a garagem por id", async () => {
      const response = await request(app)
        .get(`/api/garagem/${garagemId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(garagemId);
      expect(response.body.result).toHaveProperty("veiculos");
    });
  });

  describe("GET /api/garagem/:id/veiculos", () => {
    it("deve listar os veículos da garagem (inicialmente vazia)", async () => {
      const response = await request(app)
        .get(`/api/garagem/${garagemId}/veiculos`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBe(0);
    });
  });

  describe("POST /api/garagem/:garagemId/veiculos/:veiculoId", () => {
    it("deve alocar um veículo na garagem", async () => {
      const response = await request(app)
        .post(`/api/garagem/${garagemId}/veiculos/${veiculoId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(204);
    });

    it("deve refletir o veículo alocado", async () => {
      const response = await request(app)
        .get(`/api/garagem/${garagemId}/veiculos`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.length).toBe(1);
      expect(response.body.result[0].id).toBe(veiculoId);
    });
  });

  describe("DELETE /api/garagem/:garagemId/veiculos/:veiculoId", () => {
    it("deve desalocar o veículo da garagem", async () => {
      const response = await request(app)
        .delete(`/api/garagem/${garagemId}/veiculos/${veiculoId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(204);
    });
  });

  describe("PUT /api/garagem/:id", () => {
    it("deve atualizar a garagem", async () => {
      const response = await request(app)
        .put(`/api/garagem/${garagemId}`)
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ nome: "Garagem Central Atualizada" });

      expect(response.status).toBe(200);
      expect(response.body.result.nome).toBe("Garagem Central Atualizada");
    });

    it("deve atualizar o status para MANUTENCAO", async () => {
      const response = await request(app)
        .put(`/api/garagem/${garagemId}`)
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ status: "MANUTENCAO" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });
  });

  describe("DELETE /api/garagem/:id (soft delete)", () => {
    it("deve desativar a garagem (soft delete) sem removê-la", async () => {
      const del = await request(app)
        .delete(`/api/garagem/${garagemId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(del.status).toBe(204);
      expect(del.body).toEqual({});

      // Soft delete: a garagem ainda existe, agora com status INATIVA.
      const get = await request(app)
        .get(`/api/garagem/${garagemId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(get.status).toBe(200);
      expect(get.body.result.status).toBe("INATIVA");
    });
  });
});
