import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Race de double-booking: duas requisições concorrentes reservando o MESMO
// veículo no MESMO período. A checagem otimista de overlap passa nas duas antes
// de qualquer insert; sem o advisory lock por veículo na transação de create,
// ambas gravariam. Com o lock, exatamente uma vence (201) e a outra recebe 409.
describe("Reserva concorrente (race de double-booking)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
  });

  it("permite apenas UMA reserva quando duas concorrem pelo mesmo período", async () => {
    const periodo = futurePeriod(1, 2);
    const payload = {
      idVeiculo: veiculoId,
      idLocatario: locatario.locatarioId,
      valorTotal: 250,
      ...periodo,
    };

    const enviar = () =>
      request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send(payload);

    // Dispara as duas ao mesmo tempo.
    const [a, b] = await Promise.all([enviar(), enviar()]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflito = a.status === 409 ? a : b;
    expect(conflito.body.message).toMatch(/já possui uma reserva/i);

    // O banco confirma: uma única reserva ativa para o veículo.
    const total = await prisma.reserva.count({ where: { idVeiculo: veiculoId } });
    expect(total).toBe(1);
  });
});
