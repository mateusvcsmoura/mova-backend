import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Task 11 — corrida: mover veículo × colocar garagem em manutenção", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  it("nunca termina em erro técnico (404/500); desfechos são 200/204 ou 409 de negócio", async () => {
    const resultados: Array<[number, number]> = [];
    for (let rodada = 0; rodada < 8; rodada++) {
      const origem = await createGaragem(locador.token, locador.locadorId);
      const destino = await createGaragem(locador.token, locador.locadorId);
      const veiculo = await createVeiculo(locador.token, locador.locadorId, { garagemId: origem.id });
      const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(3 + rodada, 1));
      expect(reserva?.id).toBeTruthy();

      const [mover, manutencao] = await Promise.all([
        request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(locador.token)).send({ garagemId: destino.id }),
        request(app).put(`/api/garagem/${origem.id}`).set(auth(locador.token)).send({ status: "MANUTENCAO" }),
      ]);
      resultados.push([mover.status, manutencao.status]);

      expect(mover.status).toBe(409);
      expect(mover.body.code).toBe("VEHICLE_HAS_ACTIVE_RESERVATION");
      expect(manutencao.status).toBe(200);

      const v = await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } });
      const g = await prisma.garagem.findUniqueOrThrow({ where: { id: origem.id } });
      expect(v.garagemId).toBe(origem.id);
      expect(g.status).toBe("MANUTENCAO");
      expect(g.veiculosAlocados).toBe(1);
    }
    expect(resultados).toHaveLength(8);
  });

  it("corrida: desalocar veículo × manutenção da garagem também não gera erro técnico", async () => {
    for (let rodada = 0; rodada < 6; rodada++) {
      const origem = await createGaragem(locador.token, locador.locadorId);
      const veiculo = await createVeiculo(locador.token, locador.locadorId, { garagemId: origem.id });
      const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(20 + rodada, 1));
      expect(reserva?.id).toBeTruthy();

      const [desalocar, manutencao] = await Promise.all([
        request(app).delete(`/api/garagem/${origem.id}/veiculos/${veiculo.id}`).set(auth(locador.token)),
        request(app).put(`/api/garagem/${origem.id}`).set(auth(locador.token)).send({ status: "MANUTENCAO" }),
      ]);
      expect(desalocar.status).toBe(409);
      expect(desalocar.body.code).toBe("VEHICLE_HAS_ACTIVE_RESERVATION");
      expect(manutencao.status).toBe(200);
    }
  });
});
