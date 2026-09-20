import request from "supertest";
import { StatusReserva } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocalizacao,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const RESERVA_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

async function criarReservaNaJanela(
  token: string,
  idVeiculo: string,
  idLocatario: string,
  status: StatusReserva,
  dataHoraInicio: Date,
  dataHoraFim: Date,
) {
  const futura = await createReserva(token, idVeiculo, idLocatario, {
    dataHoraInicio: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
    dataHoraFim: new Date(Date.now() + 48 * 60 * 60 * 1_000).toISOString(),
  });
  return prisma.reserva.update({
    where: { id: futura.id },
    data: { status, dataHoraInicio, dataHoraFim },
  });
}

describe("RF14 — rastreamento do Locatário", () => {
  let locador: LocadorContext;
  let locatarioA: LocatarioContext;
  let locatarioB: LocatarioContext;
  let veiculoId: string;
  let reservaId: string;
  let inicio: Date;
  let fim: Date;

  beforeAll(async () => {
    locador = await createLocador();
    locatarioA = await createLocatario();
    locatarioB = await createLocatario();
    veiculoId = (await createVeiculo(locador.token, locador.locadorId)).id;
    inicio = new Date(Date.now() - 1_000);
    fim = new Date(Date.now() + 2 * 60 * 60 * 1_000);
    reservaId = (await criarReservaNaJanela(
      locatarioA.token, veiculoId, locatarioA.locatarioId,
      StatusReserva.CONFIRMADA, inicio, fim,
    )).id;
  });

  it("permite ao dono a partir do início e retorna coordenadas persistidas e timestamp", async () => {
    await createLocalizacao(locador.token, veiculoId, {
      latitude: -23.55,
      longitude: -46.63,
      dataHora: inicio.toISOString(),
    });

    const response = await request(app)
      .get(`/api/reserva/${reservaId}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toMatchObject({
      reservaId,
      veiculo: { id: veiculoId },
      localizacao: {
        latitude: -23.55,
        longitude: -46.63,
        dataHora: inicio.toISOString(),
      },
    });
  });

  it("retorna localização indisponível sem criar coordenadas", async () => {
    const veiculoSemPonto = await createVeiculo(locador.token, locador.locadorId);
    const reservaSemPonto = await criarReservaNaJanela(
      locatarioA.token, veiculoSemPonto.id, locatarioA.locatarioId,
      StatusReserva.EM_ANDAMENTO, inicio, fim,
    );

    const response = await request(app)
      .get(`/api/reserva/${reservaSemPonto.id}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.localizacao).toBeNull();
  });

  it.each([undefined, "Bearer token-invalido"])("rejeita token ausente ou inválido", async (authorization) => {
    const req = request(app).get(`/api/reserva/${reservaId}/localizacao`);
    if (authorization) req.set("Authorization", authorization);
    expect((await req).status).toBe(401);
  });

  it("bloqueia outro Locatário", async () => {
    const response = await request(app)
      .get(`/api/reserva/${reservaId}/localizacao`)
      .set("Authorization", `Bearer ${locatarioB.token}`);

    expect(response.status).toBe(403);
  });

  it("bloqueia reserva futura", async () => {
    const futura = await createReserva(locatarioA.token, (await createVeiculo(locador.token, locador.locadorId)).id, locatarioA.locatarioId, {
      dataHoraInicio: new Date(Date.now() + 60_000).toISOString(),
      dataHoraFim: new Date(Date.now() + 61 * 60_000).toISOString(),
    });
    await prisma.reserva.update({ where: { id: futura.id }, data: { status: StatusReserva.CONFIRMADA } });

    const response = await request(app)
      .get(`/api/reserva/${futura.id}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);

    expect(response.status).toBe(409);
  });

  it("bloqueia reserva cancelada e realizada", async () => {
    const cancelada = await prisma.reserva.update({
      where: { id: reservaId }, data: { status: StatusReserva.CANCELADA },
    });
    const canceladaResponse = await request(app).get(`/api/reserva/${cancelada.id}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);
    expect(canceladaResponse.status).toBe(409);

    await prisma.reserva.update({ where: { id: reservaId }, data: { status: StatusReserva.REALIZADA } });
    const realizadaResponse = await request(app).get(`/api/reserva/${reservaId}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);
    expect(realizadaResponse.status).toBe(409);

    await prisma.reserva.update({ where: { id: reservaId }, data: { status: StatusReserva.CONFIRMADA } });
  });

  it("bloqueia período encerrado", async () => {
    const encerrada = await criarReservaNaJanela(
      locatarioA.token, (await createVeiculo(locador.token, locador.locadorId)).id,
      locatarioA.locatarioId, StatusReserva.EM_ANDAMENTO,
      new Date(Date.now() - 120_000), new Date(Date.now() - 60_000),
    );
    const response = await request(app).get(`/api/reserva/${encerrada.id}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);
    expect(response.status).toBe(409);
  });

  it("retorna 404 para reserva inexistente", async () => {
    const response = await request(app).get(`/api/reserva/${RESERVA_INEXISTENTE}/localizacao`)
      .set("Authorization", `Bearer ${locatarioA.token}`);
    expect(response.status).toBe(404);
  });

  it("não permite obter veículo arbitrário por endpoint genérico", async () => {
    const locatarioComReservaAntiga = locatarioA;
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${locatarioComReservaAntiga.token}`);
    expect(response.status).toBe(403);
  });

  it("preserva leitura do veículo próprio pelo Locador", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${locador.token}`);
    expect(response.status).toBe(200);
  });
});
