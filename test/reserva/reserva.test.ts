import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const CODIGO_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

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

describe("Reserva — código de desbloqueio", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoId: string;
  let reservaId: string;
  let codigo: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.locadorId);
    veiculoId = veiculo.id;

    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(50, 3),
    );
    reservaId = reserva.id;
  });

  it("não deve ter código antes do pagamento", async () => {
    const response = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.codigoDesbloqueio).toBeNull();
  });

  it("deve recusar desbloqueio antes de gerar o código", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo: "ABCD-2345" });

    expect(response.status).toBe(409);
  });

  it("deve gerar código no formato XXXX-XXXX ao confirmar pagamento", async () => {
    const response = await request(app)
      .put(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ statusPagamento: "SUCESSO" });

    expect(response.status).toBe(200);
    expect(response.body.result.statusPagamento).toBe("SUCESSO");
    expect(response.body.result.codigoDesbloqueio).toMatch(CODIGO_REGEX);
    expect(response.body.result.codigoGeradoEm).not.toBeNull();
    expect(response.body.result.codigoUsadoEm).toBeNull();

    codigo = response.body.result.codigoDesbloqueio;
  });

  it("não deve regerar o código se o pagamento já estava confirmado", async () => {
    const response = await request(app)
      .put(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ statusPagamento: "SUCESSO" });

    expect(response.status).toBe(200);
    expect(response.body.result.codigoDesbloqueio).toBe(codigo);
  });

  it("deve recusar uso do código antes da data de início", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(response.status).toBe(409);
  });

  it("deve recusar código inválido", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo: "ZZZZ-9999" });

    expect(response.status).toBe(400);
  });

  it("deve desbloquear dentro da janela válida", async () => {
    // backdate: início ontem, fim amanhã -> dentro da janela de uso
    await prisma.reserva.update({
      where: { id: reservaId },
      data: {
        dataHoraInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dataHoraFim: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(response.status).toBe(200);
    expect(response.body.result.codigoUsadoEm).not.toBeNull();
  });

  it("deve recusar reuso de um código já utilizado", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(response.status).toBe(409);
  });

  it("deve expirar o código após o fim da reserva", async () => {
    // cria nova reserva, confirma pagamento, depois move a janela toda p/ o passado
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(80, 2),
    );

    await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ statusPagamento: "SUCESSO" });

    const detalhe = await prisma.reserva.findUnique({
      where: { id: reserva.id },
    });

    await prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        dataHoraInicio: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        dataHoraFim: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .post(`/api/reserva/${reserva.id}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo: detalhe!.codigoDesbloqueio! });

    expect(response.status).toBe(409);
  });
});
