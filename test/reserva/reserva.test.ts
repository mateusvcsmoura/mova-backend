import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

describe("Reserva API", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outroLocatario: LocatarioContext;
  let veiculoId: string;
  let reservaId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outroLocatario = await createLocatario();
    const veiculo = await createVeiculo(locador.locadorId);
    veiculoId = veiculo.id;
  });

  describe("POST /api/reserva", () => {
    it("deve criar uma reserva (LOCATARIO dono)", async () => {
      const periodo = futurePeriod(1, 2);
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 350.75,
          ...periodo,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.idVeiculo).toBe(veiculoId);
      expect(response.body.result.idLocatario).toBe(locatario.locatarioId);
      expect(response.body.result.valorTotal).toBe(350.75);
      expect(response.body.result.status).toBe("AGUARDANDO_PAGAMENTO");
      expect(response.body.result.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");

      reservaId = response.body.result.id;
    });

    it("deve recusar criação sem autenticação", async () => {
      const response = await request(app)
        .post("/api/reserva")
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          ...futurePeriod(10, 1),
        });

      expect(response.status).toBe(401);
    });

    it("deve recusar locatário reservando em nome de outro", async () => {
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: outroLocatario.locatarioId,
          valorTotal: 100,
          ...futurePeriod(20, 1),
        });

      expect(response.status).toBe(403);
    });

    it("deve recusar período com fim antes do início", async () => {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() + 5);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() - 1);

      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          dataHoraInicio: inicio.toISOString(),
          dataHoraFim: fim.toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it("deve recusar reserva com período no passado", async () => {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 5);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);

      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          dataHoraInicio: inicio.toISOString(),
          dataHoraFim: fim.toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it("deve recusar reserva com período sobreposto no mesmo veículo", async () => {
      // mesmo período da primeira reserva criada (1..3 dias)
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${outroLocatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: outroLocatario.locatarioId,
          valorTotal: 200,
          ...futurePeriod(1, 2),
        });

      expect(response.status).toBe(409);
    });

    it("deve recusar reserva para veículo inexistente", async () => {
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: "00000000-0000-0000-0000-000000000000",
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          ...futurePeriod(30, 1),
        });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/reserva", () => {
    it("deve listar as reservas do locatário autenticado", async () => {
      const response = await request(app)
        .get("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
      expect(
        response.body.result.every(
          (r: any) => r.idLocatario === locatario.locatarioId,
        ),
      ).toBe(true);
    });

    it("deve listar as reservas dos veículos do locador", async () => {
      const response = await request(app)
        .get("/api/reserva")
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });

    it("deve recusar listagem sem autenticação", async () => {
      const response = await request(app).get("/api/reserva");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/reserva/:id", () => {
    it("deve retornar a reserva por id (dono)", async () => {
      const response = await request(app)
        .get(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(reservaId);
    });

    it("deve recusar acesso de locatário que não é dono", async () => {
      const response = await request(app)
        .get(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${outroLocatario.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/reserva/locatario/:id_locatario", () => {
    it("deve retornar as reservas de um locatário", async () => {
      const response = await request(app)
        .get(`/api/reserva/locatario/${locatario.locatarioId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/reserva/veiculo/:id_veiculo", () => {
    it("deve retornar as reservas de um veículo (LOCADOR)", async () => {
      const response = await request(app)
        .get(`/api/reserva/veiculo/${veiculoId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/reserva/:id", () => {
    it("deve atualizar o status da reserva", async () => {
      const response = await request(app)
        .put(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("CONFIRMADA");
      expect(response.body.result.statusPagamento).toBe("SUCESSO");
    });

    it("deve recusar atualização sem nenhum campo", async () => {
      const response = await request(app)
        .put(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/reserva/:id", () => {
    it("deve remover a reserva", async () => {
      const response = await request(app)
        .delete(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});
