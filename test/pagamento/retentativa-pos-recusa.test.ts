import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  confirmarPagamentoWebhook,
  createAccount,
  createBloqueio,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Task 11 (T11-P2-001/002): uma tentativa de pagamento recusada pelo webhook
// (RN07 ou veículo/garagem indisponível) não pode tornar a reserva impagável.
// A nova tentativa, dentro do prazo e com a causa resolvida, precisa confirmar.

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const SANDBOX_PROVIDER = process.env.PAGAMENTO_SANDBOX_PROVIDER ?? "mercadopago";

describe("Task 11 — nova tentativa de pagamento após recusa no webhook", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let admin: Account;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    admin = await createAccount("ADMIN");
  });

  const pagar = (id: string, token = locatario.token) =>
    request(app).post(`/api/reserva/${id}/pagamento`).set(auth(token)).send({ metodoPagamento: "PIX" });
  const statusVeiculo = (id: string, status: string) =>
    request(app).put(`/api/veiculo/${id}`).set(auth(locador.token)).send({ status });
  const noBanco = (id: string) =>
    prisma.reserva.findUniqueOrThrow({ where: { id }, include: { cobrancas: { orderBy: { criadoEm: "asc" } }, eventosFinanceirosSandbox: true } });

  async function reservaPendente(quem: LocatarioContext = locatario) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(quem.token, veiculo.id, quem.locatarioId, futurePeriod(4, 1));
    expect(reserva?.id).toBeTruthy();
    return { veiculo, reserva };
  }

  it("RN07: webhook recusado por bloqueio grava a tentativa como FALHA (não fica PROCESSANDO)", async () => {
    const bloqueado = await createLocatario();
    const { reserva } = await reservaPendente(bloqueado);
    await createBloqueio(admin.token, bloqueado.locatarioId);

    const res = await pagar(reserva.id, bloqueado.token);
    expect(res.status).toBe(202);

    const r = await noBanco(reserva.id);
    expect(r.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(r.codigoDesbloqueio).toBeNull();
    expect(r.statusPagamento).toBe("FALHA");
    expect(r.cobrancas.map((c) => c.statusPagamento)).toEqual(["FALHA"]);
    // Valor recebido no sandbox foi estornado.
    expect(r.eventosFinanceirosSandbox.map((e) => e.tipo)).toEqual(
      expect.arrayContaining(["PAGAMENTO_RECEBIDO", "ESTORNO_CONCLUIDO"]),
    );
  });

  it("RN07: bloqueio revogado dentro do prazo → nova tentativa confirma a reserva", async () => {
    const bloqueado = await createLocatario();
    const { reserva } = await reservaPendente(bloqueado);
    const bloqueio = await createBloqueio(admin.token, bloqueado.locatarioId);
    expect((await pagar(reserva.id, bloqueado.token)).status).toBe(202);
    expect((await noBanco(reserva.id)).statusPagamento).not.toBe("SUCESSO");

    const revogacao = await request(app).post(`/api/admin/bloqueio/${bloqueio.id}/revogar`).set(auth(admin.token)).send({});
    expect(revogacao.status).toBeLessThan(300);

    const segunda = await pagar(reserva.id, bloqueado.token);
    expect(segunda.status).toBe(202);
    expect(segunda.body.result.reserva).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });

    const r = await noBanco(reserva.id);
    expect(r.codigoDesbloqueio).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    // Uma tentativa recusada e uma aprovada; nunca duas aprovadas.
    expect(r.cobrancas.map((c) => c.statusPagamento)).toEqual(["FALHA", "SUCESSO"]);
    // Só a primeira tentativa foi estornada.
    expect(r.eventosFinanceirosSandbox.filter((e) => e.tipo === "ESTORNO_CONCLUIDO")).toHaveLength(1);
  });

  it("veículo indisponível entre o início e o webhook: ao voltar a DISPONIVEL a nova tentativa confirma", async () => {
    const { veiculo, reserva } = await reservaPendente();
    // Simula uma entrega do gateway chegando depois de o veículo entrar em manutenção.
    await statusVeiculo(veiculo.id, "MANUTENCAO");
    const tardio = await confirmarPagamentoWebhook(reserva.id, {
      provider: SANDBOX_PROVIDER,
      providerEventId: `sandbox:${SANDBOX_PROVIDER}:${reserva.id}:SUCESSO`,
    });
    expect(tardio.status).toBeLessThan(300);
    expect((await noBanco(reserva.id)).statusPagamento).not.toBe("SUCESSO");

    await statusVeiculo(veiculo.id, "DISPONIVEL");
    const segunda = await pagar(reserva.id);
    expect(segunda.status).toBe(202);
    expect(segunda.body.result.reserva).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });
    expect((await noBanco(reserva.id)).codigoDesbloqueio).not.toBeNull();
  });

  it("replay do MESMO evento já estornado continua sem confirmar (idempotência preservada)", async () => {
    const { veiculo, reserva } = await reservaPendente();
    await statusVeiculo(veiculo.id, "MANUTENCAO");
    const evento = { provider: SANDBOX_PROVIDER, providerEventId: `evt-replay-${reserva.id}` };
    await confirmarPagamentoWebhook(reserva.id, evento);
    await statusVeiculo(veiculo.id, "DISPONIVEL");
    const replay = await confirmarPagamentoWebhook(reserva.id, evento);
    expect(replay.status).toBeLessThan(300);
    const r = await noBanco(reserva.id);
    expect(r.statusPagamento).not.toBe("SUCESSO");
    expect(r.codigoDesbloqueio).toBeNull();
    expect(r.eventosFinanceirosSandbox.filter((e) => e.tipo === "ESTORNO_CONCLUIDO")).toHaveLength(1);
  });

  it("pagamento aprovado sem código (falha entre commit e geração) é curado pelo próximo webhook", async () => {
    const { reserva } = await reservaPendente();
    await prisma.reserva.update({ where: { id: reserva.id }, data: { statusPagamento: "SUCESSO" } });
    const r0 = await noBanco(reserva.id);
    expect(r0.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(r0.codigoDesbloqueio).toBeNull();

    const res = await confirmarPagamentoWebhook(reserva.id, { provider: SANDBOX_PROVIDER });
    expect(res.status).toBeLessThan(300);

    const r = await noBanco(reserva.id);
    expect(r.status).toBe("CONFIRMADA");
    expect(r.statusPagamento).toBe("SUCESSO");
    expect(r.codigoDesbloqueio).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});
