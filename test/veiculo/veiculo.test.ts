import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createAccount,
  createLocador,
  createLocatario,
  createVeiculo,
  uniquePlaca,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const veiculoPayload = (idLocador: string, overrides: Record<string, unknown> = {}) => ({
  idLocador,
  placa: uniquePlaca(),
  marca: "Volkswagen",
  modelo: "Polo",
  ano: 2023,
  cambio: "Automatico",
  capacidade: 5,
  eletrico: false,
  adaptado: false,
  ...overrides,
});

describe("Veiculo API", () => {
  let locador: LocadorContext;
  let outroLocador: LocadorContext;
  let locatario: LocatarioContext;
  let admin: Account;
  let veiculoId: string;
  let modeloId: string;
  const placa = uniquePlaca();

  beforeAll(async () => {
    locador = await createLocador();
    outroLocador = await createLocador();
    locatario = await createLocatario();
    admin = await createAccount("ADMIN");
  });

  describe("POST /api/veiculo", () => {
    it("deve criar um veículo (locador dono)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locador.token))
        .send(veiculoPayload(locador.locadorId, { placa }));

      expect(response.status).toBe(201);
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
        .set(auth(locador.token))
        .send(veiculoPayload(locador.locadorId, { status: "MANUTENCAO" }));

      expect(response.status).toBe(201);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });

    it("deve recusar veículo com placa duplicada", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locador.token))
        .send(veiculoPayload(locador.locadorId, { placa }));

      expect(response.status).toBe(409);
    });

    it("deve recusar criação sem autenticação (401)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(401);
    });

    it("deve recusar criação por LOCATARIO (403)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locatario.token))
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(403);
    });

    it("deve recusar locador criar veículo em nome de outro locador (403)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(outroLocador.token))
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(403);
    });

    it("deve permitir ADMIN criar em nome de qualquer locador", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(admin.token))
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(201);
    });
  });

  describe("POST /api/veiculo/lote", () => {
    it("deve criar veículos em lote (locador dono)", async () => {
      const placas = [uniquePlaca(), uniquePlaca(), uniquePlaca()];
      const response = await request(app)
        .post("/api/veiculo/lote")
        .set(auth(locador.token))
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

    it("deve recusar lote em nome de outro locador (403)", async () => {
      const response = await request(app)
        .post("/api/veiculo/lote")
        .set(auth(outroLocador.token))
        .send({
          idLocador: locador.locadorId,
          marca: "Chevrolet",
          modelo: "Onix",
          ano: 2022,
          cambio: "Manual",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
          placas: [uniquePlaca()],
        });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/veiculo", () => {
    it("deve listar os veículos do locador autenticado", async () => {
      const response = await request(app)
        .get("/api/veiculo")
        .set(auth(locador.token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });

    it("deve recusar listagem sem autenticação", async () => {
      const response = await request(app).get("/api/veiculo");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/veiculo/:id (público)", () => {
    it("deve retornar o veículo por id", async () => {
      const response = await request(app).get(`/api/veiculo/${veiculoId}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(veiculoId);
    });

    it("não deve expor veículo INATIVO (404)", async () => {
      const inativo = await createVeiculo(locador.token, locador.locadorId, {
        status: "INATIVO",
      });

      const response = await request(app).get(`/api/veiculo/${inativo.id}`);
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/veiculo/locador/:id_locador (público)", () => {
    it("deve retornar os veículos DISPONIVEL de um locador", async () => {
      const response = await request(app).get(
        `/api/veiculo/locador/${locador.locadorId}`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(
        response.body.result.every((v: any) => v.status === "DISPONIVEL"),
      ).toBe(true);
    });
  });

  describe("PATCH /api/veiculo/modelos/:id_modelo", () => {
    it("deve atualizar o modelo (locador dono)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .set(auth(locador.token))
        .send({ capacidade: 7 });

      expect(response.status).toBe(200);
      expect(response.body.result.capacidade).toBe(7);
    });

    it("deve recusar alteração de modelo por outro locador (403)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .set(auth(outroLocador.token))
        .send({ capacidade: 9 });

      expect(response.status).toBe(403);
    });

    it("deve recusar sem autenticação (401)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .send({ capacidade: 9 });

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /api/veiculo/:id_veiculo/modelo", () => {
    it("deve trocar o modelo de um veículo (locador dono)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/${veiculoId}/modelo`)
        .set(auth(locador.token))
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

    it("deve recusar troca de modelo em veículo de outro locador (403)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/${veiculoId}/modelo`)
        .set(auth(outroLocador.token))
        .send({
          idLocador: outroLocador.locadorId,
          marca: "Toyota",
          modelo: "Corolla",
          ano: 2024,
          cambio: "Automatico",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
        });

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /api/veiculo/:id", () => {
    it("deve atualizar o status (locador dono)", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .set(auth(locador.token))
        .send({ status: "MANUTENCAO" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });

    it("deve recusar edição de veículo de outro locador (403)", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .set(auth(outroLocador.token))
        .send({ status: "INATIVO" });

      expect(response.status).toBe(403);
    });

    it("deve recusar edição sem autenticação (401)", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .send({ status: "INATIVO" });

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/veiculo/:id", () => {
    it("deve recusar exclusão de veículo de outro locador (403)", async () => {
      const response = await request(app)
        .delete(`/api/veiculo/${veiculoId}`)
        .set(auth(outroLocador.token));

      expect(response.status).toBe(403);
    });

    it("deve recusar exclusão sem autenticação (401)", async () => {
      const response = await request(app).delete(`/api/veiculo/${veiculoId}`);
      expect(response.status).toBe(401);
    });

    it("deve remover o veículo (locador dono)", async () => {
      const response = await request(app)
        .delete(`/api/veiculo/${veiculoId}`)
        .set(auth(locador.token));

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
