import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { createLocador, uniquePlaca, type LocadorContext } from "../helpers";

describe("Veiculo API", () => {
  let locador: LocadorContext;
  let veiculoId: string;
  let modeloId: string;
  const placa = uniquePlaca();

  beforeAll(async () => {
    locador = await createLocador();
  });

  describe("POST /api/veiculo", () => {
    it("deve criar um veículo", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .send({
          idLocador: locador.locadorId,
          placa,
          marca: "Volkswagen",
          modelo: "Polo",
          ano: 2023,
          cambio: "Automatico",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.placa).toBe(placa);
      expect(response.body.result.idLocador).toBe(locador.locadorId);
      expect(response.body.result).toHaveProperty("modeloVeiculo");

      veiculoId = response.body.result.id;
      modeloId = response.body.result.idModeloVeiculo;
    });

    it("deve respeitar o status informado na criação", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .send({
          idLocador: locador.locadorId,
          placa: uniquePlaca(),
          marca: "Honda",
          modelo: "Civic",
          ano: 2023,
          cambio: "Automatico",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
          status: "MANUTENCAO",
        });

      expect(response.status).toBe(201);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });

    it("deve recusar veículo com placa duplicada", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .send({
          idLocador: locador.locadorId,
          placa,
          marca: "Volkswagen",
          modelo: "Polo",
          ano: 2023,
          cambio: "Automatico",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
        });

      expect(response.status).toBe(409);
    });
  });

  describe("POST /api/veiculo/lote", () => {
    it("deve criar veículos em lote", async () => {
      const placas = [uniquePlaca(), uniquePlaca(), uniquePlaca()];
      const response = await request(app)
        .post("/api/veiculo/lote")
        .send({
          idLocador: locador.locadorId,
          marca: "Chevrolet",
          modelo: "Onix",
          ano: 2022,
          cambio: "Manual",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
          placas,
        });

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBe(placas.length);
    });
  });

  describe("GET /api/veiculo", () => {
    it("deve listar os veículos do locador autenticado", async () => {
      const response = await request(app)
        .get("/api/veiculo")
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });

    it("deve recusar listagem sem autenticação", async () => {
      const response = await request(app).get("/api/veiculo");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/veiculo/:id", () => {
    it("deve retornar o veículo por id", async () => {
      const response = await request(app).get(`/api/veiculo/${veiculoId}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(veiculoId);
    });
  });

  describe("GET /api/veiculo/locador/:id_locador", () => {
    it("deve retornar os veículos de um locador", async () => {
      const response = await request(app).get(
        `/api/veiculo/locador/${locador.locadorId}`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("PATCH /api/veiculo/modelos/:id_modelo", () => {
    it("deve atualizar o modelo de veículo", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .send({ capacidade: 7 });

      expect(response.status).toBe(200);
      expect(response.body.result.capacidade).toBe(7);
    });
  });

  describe("PATCH /api/veiculo/:id_veiculo/modelo", () => {
    it("deve trocar o modelo de um veículo específico", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/${veiculoId}/modelo`)
        .send({
          idLocador: locador.locadorId,
          marca: "Toyota",
          modelo: "Corolla",
          ano: 2024,
          cambio: "Automatico",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.result.modeloVeiculo.marca).toBe("Toyota");
    });
  });

  describe("PUT /api/veiculo/:id", () => {
    it("deve atualizar o status do veículo", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .send({ status: "MANUTENCAO" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });
  });

  describe("DELETE /api/veiculo/:id", () => {
    it("deve remover o veículo", async () => {
      const response = await request(app).delete(`/api/veiculo/${veiculoId}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
