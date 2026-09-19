import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  confirmarPagamentoWebhook,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
} from "../helpers";

describe("Integridade das operações de reserva", () => {
  it("ignora status e valorTotal enviados no PUT", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId, { valorDiaria: 100 });
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId);

    const resposta = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ status: "REALIZADA", statusPagamento: "SUCESSO", valorTotal: 1, metodoPagamento: "PIX" });

    expect(resposta.status).toBe(200);
    expect(resposta.body.result.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(resposta.body.result.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    expect(resposta.body.result.valorTotal).toBe(200);
  });

  it("isola detalhe, desbloqueio, cancelamento e devolução entre locatários", async () => {
    const locador = await createLocador();
    const dono = await createLocatario();
    const intruso = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(dono.token, veiculo.id, dono.locatarioId, futurePeriod(1, 2));
    await confirmarPagamentoWebhook(reserva.id);
    const persistida = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });

    const chamadas = await Promise.all([
      request(app).get(`/api/reserva/${reserva.id}`).set("Authorization", `Bearer ${intruso.token}`),
      request(app).post(`/api/reserva/${reserva.id}/desbloqueio`).set("Authorization", `Bearer ${intruso.token}`).send({ codigo: persistida.codigoDesbloqueio }),
      request(app).post(`/api/reserva/${reserva.id}/cancelar`).set("Authorization", `Bearer ${intruso.token}`),
      request(app).post(`/api/reserva/${reserva.id}/devolucao`).set("Authorization", `Bearer ${intruso.token}`),
    ]);
    expect(chamadas.map((resposta) => resposta.status)).toEqual([403, 403, 403, 403]);
  });

  it("consome o código de desbloqueio uma única vez sob concorrência", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(3, 2));
    await confirmarPagamentoWebhook(reserva.id);
    const confirmada = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { dataHoraInicio: new Date(Date.now() - 60 * 60 * 1000), dataHoraFim: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await prisma.localizacao.create({
      data: { idVeiculo: veiculo.id, latitude: -23.5, longitude: -46.6 },
    });

    const enviar = () => request(app)
      .post(`/api/reserva/${reserva.id}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        codigo: confirmada.codigoDesbloqueio,
        latitude: -23.5,
        longitude: -46.6,
      });
    const respostas = await Promise.all([enviar(), enviar()]);
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409]);
  });
});
