import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
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

// Janela "tardia": início daqui a 90min -> (início - 2h) já passou -> multa.
function janelaTardia() {
  const inicio = new Date(Date.now() + 90 * 60 * 1000);
  const fim = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return {
    dataHoraInicio: inicio.toISOString(),
    dataHoraFim: fim.toISOString(),
  };
}

function cancelar(token: string, id: string) {
  return request(app)
    .post(`/api/reserva/${id}/cancelar`)
    .set("Authorization", `Bearer ${token}`);
}

async function cobrancasDe(idReserva: string) {
  return prisma.cobrancaReserva.findMany({ where: { idReserva } });
}

// RN04: cancelamento como ação de domínio com política de multa (2h / 20%).
describe("Reserva — cancelamento (RN04)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  // Cada reserva usa um veículo próprio para não colidir períodos.
  async function novaReserva(overrides: Record<string, unknown> = {}) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    return createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      overrides,
    );
  }

  it("cancelar >2h antes: sem multa (cobrança 0), status CANCELADA", async () => {
    const reserva = await novaReserva({
      ...futurePeriod(5, 1),
      valorTotal: 400,
    });

    const res = await cancelar(locatario.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe("CANCELADA");

    const cobrancas = await cobrancasDe(reserva.id);
    expect(cobrancas).toHaveLength(1);
    expect(Number(cobrancas[0].valor)).toBe(0);
    expect(cobrancas[0].tipo).toBe("CANCELAMENTO");
  });

  it("cancelar ≤2h antes: multa de 20% registrada, status CANCELADA", async () => {
    const reserva = await novaReserva({ ...janelaTardia(), valorTotal: 400 });

    const res = await cancelar(locatario.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe("CANCELADA");

    const cobrancas = await cobrancasDe(reserva.id);
    expect(cobrancas).toHaveLength(1);
    expect(Number(cobrancas[0].valor)).toBe(80); // 400 * 0.20
  });

  it("multa = valorTotal * 0.20 exato (arredondamento Decimal)", async () => {
    const reserva = await novaReserva({ ...janelaTardia(), valorTotal: 333.33 });

    const res = await cancelar(locatario.token, reserva.id);
    expect(res.status).toBe(200);

    const cobrancas = await cobrancasDe(reserva.id);
    expect(Number(cobrancas[0].valor)).toBe(66.67); // round(66.666)
  });

  it("cancelar reserva já CANCELADA retorna 409", async () => {
    const reserva = await novaReserva({ ...futurePeriod(6, 1), valorTotal: 200 });

    const primeiro = await cancelar(locatario.token, reserva.id);
    expect(primeiro.status).toBe(200);

    const segundo = await cancelar(locatario.token, reserva.id);
    expect(segundo.status).toBe(409);
  });

  it("cancelar reserva REALIZADA retorna 409", async () => {
    const reserva = await novaReserva({ ...futurePeriod(7, 1), valorTotal: 200 });

    // Estado terminal setado direto no banco (não há rota de transição).
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { status: "REALIZADA" },
    });

    const res = await cancelar(locatario.token, reserva.id);
    expect(res.status).toBe(409);
  });

  it("requisitante sem acesso não cancela (403)", async () => {
    const reserva = await novaReserva({ ...futurePeriod(8, 1), valorTotal: 200 });

    const intruso = await createLocatario();
    const res = await cancelar(intruso.token, reserva.id);
    expect(res.status).toBe(403);

    // Reserva permanece não cancelada.
    const persistida = await prisma.reserva.findUnique({
      where: { id: reserva.id },
    });
    expect(persistida!.status).not.toBe("CANCELADA");
  });
});
