import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
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

// Task 10.1 — Bug A (D10.1-01..06): reserva não paga não protege o veículo,
// mas um veículo (ou garagem) indisponível não pode ter o pagamento
// confirmado. Invariável: nunca "pago/confirmado" + veículo indisponível.

const CODIGO = "VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Task 10.1 — Bug A: pagamento com veículo indisponível", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  const pagar = (id: string) =>
    request(app).post(`/api/reserva/${id}/pagamento`).set(auth(locatario.token)).send({ metodoPagamento: "PIX" });
  const statusVeiculo = (id: string, status: string) =>
    request(app).put(`/api/veiculo/${id}`).set(auth(locador.token)).send({ status });

  async function reservaPendente() {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(4, 1));
    return { veiculo, reserva };
  }

  async function semConfirmacao(idReserva: string) {
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: idReserva }, include: { cobrancas: true } });
    expect(r.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(r.statusPagamento).not.toBe("SUCESSO");
    expect(r.codigoDesbloqueio).toBeNull();
    expect(r.cobrancas.filter((c) => c.statusPagamento === "SUCESSO")).toHaveLength(0);
    return r;
  }

  it("veículo disponível: pagamento confirma normalmente", async () => {
    const { reserva } = await reservaPendente();
    const res = await pagar(reserva.id);
    expect(res.body.result.reserva).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });
  });

  for (const status of ["MANUTENCAO", "INATIVO"]) {
    it(`reserva não paga não impede ${status}, mas depois o pagamento é recusado sem cobrança, código nem QR`, async () => {
      const { veiculo, reserva } = await reservaPendente();
      const criadaEm = (await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } })).criadaEm;
      expect((await statusVeiculo(veiculo.id, status)).status).toBe(200);

      const res = await pagar(reserva.id);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(CODIGO);

      const r = await semConfirmacao(reserva.id);
      expect(r.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
      expect(r.cobrancas).toHaveLength(0);
      // TTL não é renovado.
      expect(r.criadaEm).toEqual(criadaEm);
      const qr = await request(app).get(`/api/reserva/${reserva.id}/desbloqueio/qr`).set(auth(locatario.token));
      expect(qr.status).toBe(409);
    });
  }

  it("exclusão lógica (INATIVO) também recusa o pagamento", async () => {
    const { veiculo, reserva } = await reservaPendente();
    expect((await request(app).delete(`/api/veiculo/${veiculo.id}`).set(auth(locador.token))).status).toBe(204);
    expect((await pagar(reserva.id)).body.code).toBe(CODIGO);
    await semConfirmacao(reserva.id);
  });

  it("garagem de retirada indisponível também recusa o pagamento", async () => {
    const { veiculo, reserva } = await reservaPendente();
    expect((await request(app).put(`/api/garagem/${veiculo.garagemId}`).set(auth(locador.token)).send({ status: "MANUTENCAO" })).status).toBe(200);
    const res = await pagar(reserva.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA");
    await semConfirmacao(reserva.id);
  });

  it("recusa não é definitiva: veículo volta a DISPONIVEL dentro do prazo e o pagamento confirma", async () => {
    const { veiculo, reserva } = await reservaPendente();
    await statusVeiculo(veiculo.id, "MANUTENCAO");
    expect((await pagar(reserva.id)).status).toBe(409);
    await statusVeiculo(veiculo.id, "DISPONIVEL");
    expect((await pagar(reserva.id)).body.result.reserva.status).toBe("CONFIRMADA");
  });

  it("após a recusa, aos 15 min a reserva expira normalmente (Task 10)", async () => {
    const { veiculo, reserva } = await reservaPendente();
    await statusVeiculo(veiculo.id, "MANUTENCAO");
    await pagar(reserva.id);
    await prisma.reserva.update({ where: { id: reserva.id }, data: { criadaEm: new Date(Date.now() - 16 * 60 * 1000) } });
    const consulta = await request(app).get(`/api/reserva/${reserva.id}`).set(auth(locatario.token));
    expect(consulta.body.result).toMatchObject({ status: "CANCELADA", codigoDesbloqueio: null });
    expect(consulta.body.result.expiradaEm).toBeTruthy();
  });

  it("webhook não burla a regra: valor recebido é estornado e a reserva não confirma; duplicado é idempotente", async () => {
    const { veiculo, reserva } = await reservaPendente();
    await statusVeiculo(veiculo.id, "MANUTENCAO");

    const primeiro = await confirmarPagamentoWebhook(reserva.id, { provider: "mercadopago" });
    const segundo = await confirmarPagamentoWebhook(reserva.id, { provider: "mercadopago" });
    expect(primeiro.status).toBeLessThan(300);
    expect(segundo.status).toBeLessThan(300);

    await semConfirmacao(reserva.id);
    const eventos = await prisma.eventoFinanceiroSandbox.findMany({ where: { idReserva: reserva.id } });
    const contar = (tipo: string) => eventos.filter((e) => e.tipo === tipo).length;
    expect(contar("PAGAMENTO_RECEBIDO")).toBe(1);
    expect(contar("ESTORNO_CONCLUIDO")).toBe(1);
    expect((await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } })).status).toBe("MANUTENCAO");
  });

  it("erro não expõe dados do locador nem de outras reservas, em pt-BR, en e es", async () => {
    const { veiculo, reserva } = await reservaPendente();
    await statusVeiculo(veiculo.id, "MANUTENCAO");
    const mensagens = new Set<string>();
    for (const idioma of ["pt-BR", "en", "es"]) {
      const res = await request(app)
        .post(`/api/reserva/${reserva.id}/pagamento`)
        .set(auth(locatario.token))
        .set("Accept-Language", idioma)
        .send({ metodoPagamento: "PIX" });
      expect(res.body.code).toBe(CODIGO);
      mensagens.add(res.body.message);
      const corpo = JSON.stringify(res.body);
      for (const dado of [locador.locadorId, locador.email, locador.cnpj, veiculo.placa, veiculo.id]) {
        expect(corpo).not.toContain(dado);
      }
    }
    expect(mensagens.size).toBe(3);
  });

  it("corrida pagamento × manutenção nunca termina em reserva paga com veículo indisponível", async () => {
    const resultados = { pagamentoVenceu: 0, manutencaoVenceu: 0 };
    for (let i = 0; i < 6; i++) {
      const { veiculo, reserva } = await reservaPendente();
      const [pagamento, manutencao] = await Promise.all([pagar(reserva.id), statusVeiculo(veiculo.id, "MANUTENCAO")]);

      const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
      const v = await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } });
      const pago = r.statusPagamento === "SUCESSO";
      expect(pago && v.status === "MANUTENCAO").toBe(false);
      if (pago) {
        resultados.pagamentoVenceu++;
        expect(manutencao.status).toBe(409);
        expect(r.status).toBe("CONFIRMADA");
      } else {
        resultados.manutencaoVenceu++;
        expect(manutencao.status).toBe(200);
        // Manutenção antes do início → 409; entre o início e o webhook →
        // tentativa não aprovada (o valor do sandbox é estornado).
        expect([409, 202]).toContain(pagamento.status);
        expect(r.codigoDesbloqueio).toBeNull();
        expect(r.status).toBe("AGUARDANDO_PAGAMENTO");
      }
    }
    expect(resultados.pagamentoVenceu + resultados.manutencaoVenceu).toBe(6);
  });
});
