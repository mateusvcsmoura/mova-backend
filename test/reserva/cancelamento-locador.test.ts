import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createAdminAccount,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Task 10 — BUG-02 (D10-01): a multa de 20 % da RN04 é só do cancelamento
// tardio iniciado pelo LOCATÁRIO. Cancelamento operacional (LOCADOR, ou ADMIN
// em nome da operação) nunca multa o locatário e, se pago, estorna 100 %.

// Início daqui a 90 min: (início - 2h) já passou -> janela tardia.
function janelaTardia() {
  const inicio = new Date(Date.now() + 90 * 60 * 1000);
  const fim = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return { dataHoraInicio: inicio.toISOString(), dataHoraFim: fim.toISOString() };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const cancelar = (token: string, id: string) =>
  request(app).post(`/api/reserva/${id}/cancelar`).set(auth(token));

const pagar = (token: string, id: string) =>
  request(app).post(`/api/reserva/${id}/pagamento`).set(auth(token)).send({ metodoPagamento: "PIX" });

const pagamento = (token: string, id: string) =>
  request(app).get(`/api/reserva/${id}/pagamento`).set(auth(token));

describe("Task 10 — BUG-02: cancelamento pelo locador (RN04, RN09)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let admin: Account;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    admin = await createAdminAccount();
  });

  let seqModelo = 0;
  async function novaReserva(periodo: Record<string, string>, valorDiaria = 400) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Onix-${valorDiaria}-${++seqModelo}`,
      valorDiaria,
    });
    return createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
  }

  // Pagamento confirmado pelo fluxo oficial (sandbox PIX); o período tardio é
  // aplicado depois, porque o pagamento não depende do horário de início.
  async function reservaPagaTardia() {
    const reserva = await novaReserva(futurePeriod(3, 1));
    const pago = await pagar(locatario.token, reserva.id);
    expect(pago.status).toBeLessThan(300);
    const { dataHoraInicio, dataHoraFim } = janelaTardia();
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { dataHoraInicio: new Date(dataHoraInicio), dataHoraFim: new Date(dataHoraFim) },
    });
    return reserva;
  }

  it("locatário cancela com mais de 2h: sem multa (regra preservada)", async () => {
    const reserva = await novaReserva(futurePeriod(5, 1));
    const res = await cancelar(locatario.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.multaCancelamento).toBe(0);
  });

  it("locatário cancela com menos de 2h: multa de 20 % (regra preservada)", async () => {
    const reserva = await novaReserva(janelaTardia());
    const res = await cancelar(locatario.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.multaCancelamento).toBe(80);
    // Isola os próximos cenários do bloqueio RN07 que essa multa gera.
    await prisma.cobrancaReserva.updateMany({
      where: { idReserva: reserva.id },
      data: { statusPagamento: "SUCESSO" },
    });
  });

  it("locador cancela com mais de 2h: sem multa", async () => {
    const reserva = await novaReserva(futurePeriod(5, 1));
    const res = await cancelar(locador.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe("CANCELADA");
    expect(res.body.result.multaCancelamento).toBe(0);
  });

  it("locador cancela com menos de 2h: sem multa e sem bloquear o locatário (RN07)", async () => {
    const reserva = await novaReserva(janelaTardia());
    const res = await cancelar(locador.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.multaCancelamento).toBe(0);

    const cobrancas = await prisma.cobrancaReserva.findMany({ where: { idReserva: reserva.id } });
    expect(cobrancas).toHaveLength(1);
    expect(cobrancas[0]).toMatchObject({ tipo: "CANCELAMENTO", statusPagamento: "SUCESSO" });
    expect(Number(cobrancas[0].valor)).toBe(0);

    // Sem pendência financeira: o locatário continua podendo reservar.
    const outra = await novaReserva(futurePeriod(10, 1));
    expect(outra.id).toBeTruthy();
  });

  it("locador cancela reserva paga em cima da hora: estorno integral (100 %)", async () => {
    const reserva = await reservaPagaTardia();
    const res = await cancelar(locador.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.multaCancelamento).toBe(0);

    const consulta = await pagamento(locatario.token, reserva.id);
    expect(consulta.status).toBe(200);
    expect(consulta.body.result).toMatchObject({
      statusReserva: "CANCELADA",
      valorPago: 400,
      multaCancelamento: 0,
      valorElegivelEstorno: 400,
      statusEstorno: "CONCLUIDO",
    });
  });

  it("locador cancela reserva não paga: nenhuma cobrança e nenhum estorno", async () => {
    const reserva = await novaReserva(janelaTardia());
    const res = await cancelar(locador.token, reserva.id);
    expect(res.status).toBe(200);

    const cobrado = await prisma.cobrancaReserva.aggregate({
      where: { idReserva: reserva.id },
      _sum: { valor: true },
    });
    expect(Number(cobrado._sum.valor ?? 0)).toBe(0);
    expect(await prisma.eventoFinanceiroSandbox.count({ where: { idReserva: reserva.id } })).toBe(0);
  });

  it("ADMIN cancela operacionalmente: mesma proteção ao locatário, auditado como ADMIN", async () => {
    const reserva = await reservaPagaTardia();
    const res = await cancelar(admin.token, reserva.id);
    expect(res.status).toBe(200);
    expect(res.body.result.multaCancelamento).toBe(0);

    const consulta = await pagamento(locatario.token, reserva.id);
    expect(consulta.body.result.valorElegivelEstorno).toBe(400);

    const [registro] = await prisma.registroAuditoria.findMany({ where: { idEntidade: reserva.id } });
    expect(registro).toMatchObject({
      idAtor: admin.conta.id,
      cargoAtor: "ADMIN",
      idLocador: locador.locadorId,
      acao: "CANCELAMENTO",
    });
  });

  it("cancelar de novo não gera segundo estorno nem segunda cobrança", async () => {
    const reserva = await reservaPagaTardia();
    expect((await cancelar(locador.token, reserva.id)).status).toBe(200);
    expect((await cancelar(locador.token, reserva.id)).status).toBe(409);
    expect((await cancelar(locatario.token, reserva.id)).status).toBe(409);

    const contar = (tipo: "ESTORNO_SOLICITADO" | "ESTORNO_CONCLUIDO") =>
      prisma.eventoFinanceiroSandbox.count({ where: { idReserva: reserva.id, tipo } });
    expect(await contar("ESTORNO_SOLICITADO")).toBe(1);
    expect(await contar("ESTORNO_CONCLUIDO")).toBe(1);
    expect(
      await prisma.cobrancaReserva.count({ where: { idReserva: reserva.id, tipo: "CANCELAMENTO" } }),
    ).toBe(1);
  });

  it("auditoria registra o locador como ator e o histórico da reserva é preservado", async () => {
    const reserva = await reservaPagaTardia();
    expect((await cancelar(locador.token, reserva.id)).status).toBe(200);

    const registros = await prisma.registroAuditoria.findMany({ where: { idEntidade: reserva.id } });
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ idAtor: locador.conta.id, cargoAtor: "LOCADOR", acao: "CANCELAMENTO" });

    // Nada é apagado: reserva, cobrança do pagamento e trilha sandbox continuam.
    const preservada = await prisma.reserva.findUnique({
      where: { id: reserva.id },
      include: { cobrancas: true, eventosFinanceirosSandbox: true },
    });
    expect(preservada).toMatchObject({ status: "CANCELADA", statusPagamento: "SUCESSO" });
    expect(preservada!.cobrancas.map((c) => c.tipo).sort()).toEqual(["CANCELAMENTO", "PAGAMENTO_RESERVA"]);
    expect(preservada!.eventosFinanceirosSandbox.map((e) => e.tipo)).toContain("PAGAMENTO_RECEBIDO");
  });
});
