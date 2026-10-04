import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { PrismaReservaRepository } from "../../src/repositories/prisma/prisma.reserva.repository";
import {
  PRAZO_PAGAMENTO_MINUTOS,
  prazoPagamentoVencido,
} from "../../src/shared/prazo-pagamento";
import {
  confirmarPagamentoWebhook,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Task 10 — BUG-05 (D10-03/D10-04), BUG-03/M-02 (D10-02) e D10-05.
// O tempo é controlado pela data de criação gravada no banco (fixture), não
// por espera real: nenhum teste aguarda 15 minutos.

const MIN = 60 * 1000;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const CARTAO_PENDENTE = { numero: "4111111111110001", nome: "Teste", validade: "12/30", cvv: "123" };
const CARTAO_RECUSADO = { numero: "4111111111110000", nome: "Teste", validade: "12/30", cvv: "123" };

// Desloca a criação da reserva para o passado: simula o relógio avançando.
const envelhecer = (id: string, minutos: number) =>
  prisma.reserva.update({ where: { id }, data: { criadaEm: new Date(Date.now() - minutos * MIN) } });

describe("Task 10 — prazo de pagamento (unidade)", () => {
  const inicio = new Date("2026-10-05T12:00:00.000Z");
  it("o prazo oficial é de 15 minutos", () => {
    expect(PRAZO_PAGAMENTO_MINUTOS).toBe(15);
  });
  it("antes do limite continua válido", () => {
    expect(prazoPagamentoVencido(inicio, new Date("2026-10-05T12:14:59.999Z"))).toBe(false);
  });
  it("exatamente no limite já está vencido", () => {
    expect(prazoPagamentoVencido(inicio, new Date("2026-10-05T12:15:00.000Z"))).toBe(true);
  });
  it("compara instantes absolutos, sem depender de fuso", () => {
    // 09:15 em São Paulo (-03:00) é o mesmo instante que 12:15Z.
    expect(prazoPagamentoVencido(inicio, new Date("2026-10-05T09:15:00.000-03:00"))).toBe(true);
  });
});

describe("Task 10 — BUG-05/BUG-03: expiração da reserva e do pagamento", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outroLocatario: LocatarioContext;
  const repo = new PrismaReservaRepository();

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outroLocatario = await createLocatario();
  });

  const novoVeiculo = () => createVeiculo(locador.token, locador.locadorId);
  const pagar = (token: string, id: string, dados: Record<string, unknown> = { metodoPagamento: "PIX" }) =>
    request(app).post(`/api/reserva/${id}/pagamento`).set(auth(token)).send(dados);
  const reservar = (token: string, idVeiculo: string, idLocatario: string, periodo: Record<string, string>) =>
    request(app).post("/api/reserva").set(auth(token)).send({ idVeiculo, idLocatario, ...periodo });
  const consultar = (token: string, id: string) =>
    request(app).get(`/api/reserva/${id}`).set(auth(token));

  it("reserva com menos de 15 min sem pagamento continua segurando o veículo", async () => {
    const veiculo = await novoVeiculo();
    const periodo = futurePeriod(4, 1);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    await envelhecer(reserva.id, 14);

    const concorrente = await reservar(outroLocatario.token, veiculo.id, outroLocatario.locatarioId, periodo);
    expect(concorrente.status).toBe(409);
  });

  it("após 15 min sem pagamento o veículo é liberado e a reserva vira histórico expirado (sem DELETE)", async () => {
    const veiculo = await novoVeiculo();
    const periodo = futurePeriod(4, 1);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    await envelhecer(reserva.id, 16);
    const totalAntes = await prisma.reserva.count();

    // Cotação e nova reserva já não enxergam conflito.
    const cotacao = await request(app)
      .post("/api/reserva/precificacao")
      .set(auth(outroLocatario.token))
      .send({ idVeiculo: veiculo.id, ...periodo });
    expect(cotacao.status).toBe(200);
    const nova = await reservar(outroLocatario.token, veiculo.id, outroLocatario.locatarioId, periodo);
    expect(nova.status).toBe(201);

    const expirada = await consultar(locatario.token, reserva.id);
    expect(expirada.status).toBe(200);
    expect(expirada.body.result).toMatchObject({ status: "CANCELADA", codigoDesbloqueio: null });
    expect(expirada.body.result.expiradaEm).toBeTruthy();
    // Expiração não é cancelamento voluntário: sem cobrança de cancelamento.
    expect(await prisma.cobrancaReserva.count({ where: { idReserva: reserva.id } })).toBe(0);
    expect(await prisma.reserva.count()).toBe(totalAntes + 1);
  });

  it("reserva expirada não aparece como ativa e não gera código nem QR", async () => {
    const veiculo = await novoVeiculo();
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    await envelhecer(reserva.id, 30);

    const lista = await request(app).get("/api/reserva").set(auth(locatario.token));
    const item = lista.body.result.find((r: { id: string }) => r.id === reserva.id);
    expect(item.status).toBe("CANCELADA");

    const qr = await request(app).get(`/api/reserva/${reserva.id}/desbloqueio/qr`).set(auth(locatario.token));
    expect(qr.status).toBe(409);

    const pagamento = await pagar(locatario.token, reserva.id);
    expect(pagamento.status).toBe(409);
    const depois = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(depois.codigoDesbloqueio).toBeNull();
    expect(depois.statusPagamento).not.toBe("SUCESSO");
  });

  it("pagamento confirmado antes do limite preserva a reserva (confirmado nunca expira)", async () => {
    const veiculo = await novoVeiculo();
    const periodo = futurePeriod(4, 1);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    expect((await pagar(locatario.token, reserva.id)).status).toBeLessThan(300);
    await envelhecer(reserva.id, 60);

    const consulta = await consultar(locatario.token, reserva.id);
    expect(consulta.body.result).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO", expiradaEm: null });
    expect(consulta.body.result.codigoDesbloqueio).toBeTruthy();
    expect(await repo.expirarReservasVencidas()).toBe(0);
    const concorrente = await reservar(outroLocatario.token, veiculo.id, outroLocatario.locatarioId, periodo);
    expect(concorrente.status).toBe(409);
  });

  it("reserva vencida deixa de fixar a garagem do veículo", async () => {
    const veiculo = await novoVeiculo();
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    const destino = await request(app)
      .post("/api/garagem")
      .set(auth(locador.token))
      .send({ idLocador: locador.locadorId, nome: "Garagem destino", endereco: "Rua B, 2", capacidade: 5, acessibilidade: true });
    const mover = () =>
      request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(locador.token)).send({ garagemId: destino.body.result.id });

    expect((await mover()).status).toBe(409);
    await envelhecer(reserva.id, 16);
    expect((await mover()).status).toBe(200);
  });

  it("rotina de expiração é idempotente", async () => {
    const veiculo = await novoVeiculo();
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    await envelhecer(reserva.id, 20);

    expect(await repo.expirarReservasVencidas({ id: reserva.id })).toBe(1);
    const primeira = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(await repo.expirarReservasVencidas({ id: reserva.id })).toBe(0);
    const segunda = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(segunda.expiradaEm).toEqual(primeira.expiradaEm);
    expect(segunda.status).toBe("CANCELADA");
  });

  it("PROCESSANDO com menos de 15 min continua válido e bloqueia nova tentativa", async () => {
    const veiculo = await novoVeiculo();
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    const pendente = await pagar(locatario.token, reserva.id, { metodoPagamento: "CARTAO_CREDITO", cartao: CARTAO_PENDENTE });
    expect(pendente.body.result.reserva.statusPagamento).toBe("PROCESSANDO");
    await envelhecer(reserva.id, 10);

    expect((await pagar(locatario.token, reserva.id)).status).toBe(409);
    const consulta = await consultar(locatario.token, reserva.id);
    expect(consulta.body.result).toMatchObject({ status: "AGUARDANDO_PAGAMENTO", statusPagamento: "PROCESSANDO" });
  });

  it("PROCESSANDO depois de 15 min expira: sem cobrança confirmada, sem código, veículo liberado para nova tentativa", async () => {
    const veiculo = await novoVeiculo();
    const periodo = futurePeriod(4, 1);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    await pagar(locatario.token, reserva.id, { metodoPagamento: "CARTAO_CREDITO", cartao: CARTAO_PENDENTE });
    await envelhecer(reserva.id, 16);

    const consulta = await consultar(locatario.token, reserva.id);
    expect(consulta.body.result).toMatchObject({ status: "CANCELADA", statusPagamento: "FALHA", codigoDesbloqueio: null });
    const cobrancas = await prisma.cobrancaReserva.findMany({ where: { idReserva: reserva.id } });
    expect(cobrancas.map((c) => c.statusPagamento)).toEqual(["FALHA"]);

    // Nova tentativa: o mesmo locatário reserva de novo e paga.
    const nova = await reservar(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    expect(nova.status).toBe(201);
    const pago = await pagar(locatario.token, nova.body.result.id);
    expect(pago.body.result.reserva).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });
  });

  it("pagamento recusado não entra no fluxo de expiração e pode ser repetido logo", async () => {
    const veiculo = await novoVeiculo();
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    const recusado = await pagar(locatario.token, reserva.id, { metodoPagamento: "CARTAO_CREDITO", cartao: CARTAO_RECUSADO });
    expect(recusado.body.result.reserva).toMatchObject({ status: "AGUARDANDO_PAGAMENTO", statusPagamento: "FALHA" });

    const aprovado = await pagar(locatario.token, reserva.id);
    expect(aprovado.body.result.reserva).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });

    // Nenhuma cobrança duplicada: a tentativa recusada continua FALHA.
    const cobrancas = await prisma.cobrancaReserva.findMany({
      where: { idReserva: reserva.id, tipo: "PAGAMENTO_RESERVA" },
      orderBy: { criadoEm: "asc" },
    });
    expect(cobrancas.map((c) => c.statusPagamento)).toEqual(["FALHA", "SUCESSO"]);
  });

  it("webhook tardio da tentativa expirada não ressuscita a reserva nem afeta a nova", async () => {
    const veiculo = await novoVeiculo();
    const periodo = futurePeriod(4, 1);
    const tentativaA = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    await pagar(locatario.token, tentativaA.id, { metodoPagamento: "CARTAO_CREDITO", cartao: CARTAO_PENDENTE });
    await envelhecer(tentativaA.id, 16);
    // Ninguém consultou a reserva: a expiração acontece na chegada do webhook.

    const tentativaB = await reservar(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    expect(tentativaB.status).toBe(201);
    await pagar(locatario.token, tentativaB.body.result.id);

    const tardio = await confirmarPagamentoWebhook(tentativaA.id, { provider: "mercadopago" });
    expect(tardio.status).toBeLessThan(300);

    const a = await prisma.reserva.findUniqueOrThrow({ where: { id: tentativaA.id } });
    expect(a).toMatchObject({ status: "CANCELADA", codigoDesbloqueio: null });
    expect(a.statusPagamento).not.toBe("SUCESSO");
    expect(a.expiradaEm).not.toBeNull();
    // O valor recebido tarde é devolvido no sandbox, nunca vira confirmação.
    const eventosA = await prisma.eventoFinanceiroSandbox.findMany({ where: { idReserva: tentativaA.id } });
    expect(eventosA.map((e) => e.tipo)).toContain("ESTORNO_CONCLUIDO");

    const b = await prisma.reserva.findUniqueOrThrow({ where: { id: tentativaB.body.result.id } });
    expect(b).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });
  });

  it("webhook duplicado continua idempotente (um recebimento, um código)", async () => {
    const veiculo = await novoVeiculo();
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    await confirmarPagamentoWebhook(reserva.id, { provider: "mercadopago" });
    const primeiro = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    await confirmarPagamentoWebhook(reserva.id, { provider: "mercadopago" });
    const segundo = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });

    expect(segundo.codigoDesbloqueio).toBe(primeiro.codigoDesbloqueio);
    expect(
      await prisma.eventoFinanceiroSandbox.count({ where: { idReserva: reserva.id, tipo: "PAGAMENTO_RECEBIDO" } }),
    ).toBe(1);
  });

  it("concorrência no limite: confirmação × expiração nunca deixa estado misto", async () => {
    // Três idades: claramente válida, exatamente no limite e vencida.
    for (const minutos of [14, 15, 16]) {
      const veiculo = await novoVeiculo();
      const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
      await envelhecer(reserva.id, minutos);

      await Promise.all([
        confirmarPagamentoWebhook(reserva.id, { provider: "mercadopago" }),
        repo.expirarReservasVencidas({ id: reserva.id }),
        repo.expirarReservasVencidas({ id: reserva.id }),
      ]);

      const final = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
      if (minutos === 14) {
        expect(final).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO", expiradaEm: null });
        expect(final.codigoDesbloqueio).toBeTruthy();
      } else {
        expect(final.status).toBe("CANCELADA");
        expect(final.expiradaEm).not.toBeNull();
        expect(final.statusPagamento).not.toBe("SUCESSO");
        expect(final.codigoDesbloqueio).toBeNull();
      }
    }
  });
});

describe("Task 10 — BUG-03/M-02: cobrança avulsa presa em PROCESSANDO", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  it("depois de 15 min a cobrança PROCESSANDO expira para FALHA e pode ser paga de novo", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const inicio = new Date(Date.now() + 90 * MIN);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, {
      dataHoraInicio: inicio.toISOString(),
      dataHoraFim: new Date(inicio.getTime() + 120 * MIN).toISOString(),
    });
    const cancelamento = await request(app).post(`/api/reserva/${reserva.id}/cancelar`).set(auth(locatario.token));
    expect(cancelamento.body.result.multaCancelamento).toBeGreaterThan(0);
    const multa = await prisma.cobrancaReserva.findFirstOrThrow({ where: { idReserva: reserva.id, tipo: "CANCELAMENTO" } });

    const pagarMulta = (dados: Record<string, unknown>) =>
      request(app).post(`/api/cobranca/${multa.id}/pagamento`).set(auth(locatario.token)).send(dados);

    const pendente = await pagarMulta({ metodoPagamento: "CARTAO_CREDITO", cartao: CARTAO_PENDENTE });
    expect(pendente.body.result.cobranca.statusPagamento).toBe("PROCESSANDO");
    expect((await pagarMulta({ metodoPagamento: "PIX" })).status).toBe(409);

    // 16 minutos depois do início do processamento.
    await prisma.$executeRaw`UPDATE "CobrancaReserva" SET "atualizadoEm" = ${new Date(Date.now() - 16 * MIN)} WHERE "id" = ${multa.id}::uuid`;

    const pendentes = await request(app).get("/api/cobranca/pendentes").set(auth(locatario.token));
    expect(pendentes.body.result.find((c: { id: string }) => c.id === multa.id).statusPagamento).toBe("FALHA");

    const quitada = await pagarMulta({ metodoPagamento: "PIX" });
    expect(quitada.status).toBe(202);
    expect(quitada.body.result.cobranca.statusPagamento).toBe("SUCESSO");
    expect(await prisma.cobrancaReserva.count({ where: { idReserva: reserva.id, tipo: "CANCELAMENTO" } })).toBe(1);
  });
});
