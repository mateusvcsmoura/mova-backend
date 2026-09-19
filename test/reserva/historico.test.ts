import request from "supertest";
import { StatusReserva } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
} from "../helpers";

describe("Histórico de reservas do locatário", () => {
  it("retorna lista vazia paginada para quem ainda não possui reservas", async () => {
    const locatario = await createLocatario();

    const resposta = await request(app)
      .get(`/api/reserva/locatario/${locatario.locatarioId}?page=1&limit=2`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      result: [],
      pagination: { page: 1, limit: 2, total: 0, totalPages: 0 },
    });
  });

  it("entrega veículo, garagem, estados e paginação sem acesso cruzado", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const outroLocatario = await createLocatario();
    const garagem = await createGaragem(locador.token, locador.locadorId);
    const status = [
      StatusReserva.CANCELADA,
      StatusReserva.REALIZADA,
      StatusReserva.CONFIRMADA,
      StatusReserva.EM_ANDAMENTO,
    ];
    const reservas = [];

    for (let indice = 0; indice < status.length; indice += 1) {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const reserva = await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
        { idGaragemDevolucao: garagem.id, ...futurePeriod(10 + indice * 3, 1) },
      );
      await prisma.reserva.update({
        where: { id: reserva.id },
        data: { status: status[indice] },
      });
      reservas.push(reserva);
    }

    const primeiraPagina = await request(app)
      .get(`/api/reserva/locatario/${locatario.locatarioId}?page=1&limit=2`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(primeiraPagina.status).toBe(200);
    expect(primeiraPagina.body.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(primeiraPagina.body.result).toHaveLength(2);
    expect(primeiraPagina.body.result[0]).toMatchObject({
      veiculo: { modeloVeiculo: { marca: "Fiat", modelo: "Argo" } },
      garagemDevolucao: { id: garagem.id, nome: garagem.nome, endereco: garagem.endereco },
    });

    const segundaPagina = await request(app)
      .get(`/api/reserva/locatario/${locatario.locatarioId}?page=2&limit=2`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(segundaPagina.status).toBe(200);
    expect(segundaPagina.body.result).toHaveLength(2);
    expect(new Set([...primeiraPagina.body.result, ...segundaPagina.body.result].map((r: any) => r.status))).toEqual(new Set(status));

    const detalhe = await request(app)
      .get(`/api/reserva/${reservas[0].id}`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.result).toMatchObject({
      id: reservas[0].id,
      veiculo: { id: reservas[0].idVeiculo, modeloVeiculo: { modelo: "Argo" } },
      garagemDevolucao: { id: garagem.id },
    });

    const acessoDeOutro = await request(app)
      .get(`/api/reserva/locatario/${locatario.locatarioId}`)
      .set("Authorization", `Bearer ${outroLocatario.token}`);
    expect(acessoDeOutro.status).toBe(403);
  });
});
