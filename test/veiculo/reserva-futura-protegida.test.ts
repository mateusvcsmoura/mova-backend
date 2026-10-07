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

const CODIGO = "VEICULO_COM_RESERVA_FUTURA_CONFIRMADA";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const DIA = 24 * 60 * 60 * 1000;

describe("Task 10 — BUG-14: veículo com reserva futura paga (RF19)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  const alterarStatus = (id: string, status: string, idioma = "pt-BR") =>
    request(app).put(`/api/veiculo/${id}`).set(auth(locador.token)).set("Accept-Language", idioma).send({ status });
  const excluir = (id: string) => request(app).delete(`/api/veiculo/${id}`).set(auth(locador.token));

  async function veiculoComReservaPaga(periodo = futurePeriod(3, 2)) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, periodo);
    await confirmarPagamentoWebhook(reserva.id, { provider: "mercadopago" });
    const paga = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(paga).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });
    return { veiculo, reserva: paga };
  }

  it("sem reserva futura: manutenção e inativação seguem permitidas", async () => {
    const a = await createVeiculo(locador.token, locador.locadorId);
    expect((await alterarStatus(a.id, "MANUTENCAO")).status).toBe(200);
    const b = await createVeiculo(locador.token, locador.locadorId);
    expect((await alterarStatus(b.id, "INATIVO")).status).toBe(200);
    const c = await createVeiculo(locador.token, locador.locadorId);
    expect((await excluir(c.id)).status).toBe(204);
  });

  it("reserva passada, cancelada ou não paga vencida não bloqueia", async () => {
    // Passada: CONFIRMADA e paga, mas o período já terminou.
    const passada = await veiculoComReservaPaga();
    await prisma.reserva.update({
      where: { id: passada.reserva.id },
      data: { dataHoraInicio: new Date(Date.now() - 3 * DIA), dataHoraFim: new Date(Date.now() - 2 * DIA) },
    });
    expect((await alterarStatus(passada.veiculo.id, "MANUTENCAO")).status).toBe(200);

    // Cancelada: o compromisso foi desfeito (com estorno).
    const cancelada = await veiculoComReservaPaga();
    await request(app).post(`/api/reserva/${cancelada.reserva.id}/cancelar`).set(auth(locador.token));
    expect((await alterarStatus(cancelada.veiculo.id, "INATIVO")).status).toBe(200);

    // Aguardando pagamento com prazo vencido (BUG-05): não segura o veículo.
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const pendente = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(3, 1));
    await prisma.reserva.update({ where: { id: pendente.id }, data: { criadaEm: new Date(Date.now() - 16 * 60 * 1000) } });
    expect((await alterarStatus(veiculo.id, "MANUTENCAO")).status).toBe(200);
  });

  it("reserva futura paga bloqueia MANUTENCAO com 409 de domínio e nada muda", async () => {
    const { veiculo, reserva } = await veiculoComReservaPaga();
    const auditoriaAntes = await prisma.registroAuditoria.count({ where: { idEntidade: veiculo.id } });

    const res = await alterarStatus(veiculo.id, "MANUTENCAO");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(CODIGO);
    expect(res.body.message).toMatch(/reserva/i);

    expect((await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } })).status).toBe("DISPONIVEL");
    const depois = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(depois).toMatchObject({ status: "CONFIRMADA", statusPagamento: "SUCESSO", codigoDesbloqueio: reserva.codigoDesbloqueio });
    // Tentativa recusada não deixa auditoria de alteração que não aconteceu.
    expect(await prisma.registroAuditoria.count({ where: { idEntidade: veiculo.id } })).toBe(auditoriaAntes);
  });

  it("reserva futura paga bloqueia INATIVO pelo PUT e pela exclusão lógica", async () => {
    const { veiculo } = await veiculoComReservaPaga();
    const put = await alterarStatus(veiculo.id, "INATIVO");
    expect(put.status).toBe(409);
    expect(put.body.code).toBe(CODIGO);
    const del = await excluir(veiculo.id);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe(CODIGO);
    expect((await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } })).status).toBe("DISPONIVEL");
    expect(await prisma.reserva.count({ where: { idVeiculo: veiculo.id, status: "CANCELADA" } })).toBe(0);
  });

  it("reserva em andamento também é compromisso protegido", async () => {
    const { veiculo, reserva } = await veiculoComReservaPaga();
    await prisma.reserva.update({ where: { id: reserva.id }, data: { status: "EM_ANDAMENTO", codigoUsadoEm: new Date() } });
    expect((await alterarStatus(veiculo.id, "MANUTENCAO")).status).toBe(409);
  });

  it("outras edições do veículo continuam livres e o erro não expõe dados do locatário", async () => {
    const { veiculo } = await veiculoComReservaPaga();
    const placa = `TEN${Math.floor(1000 + Math.random() * 8999)}`;
    const edicao = await request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(locador.token)).send({ placa });
    expect(edicao.status).toBe(200);
    // Mesmo status (sem transição) também não é bloqueado.
    expect((await alterarStatus(veiculo.id, "DISPONIVEL")).status).toBe(200);

    const res = await alterarStatus(veiculo.id, "MANUTENCAO");
    const conta = await prisma.conta.findUniqueOrThrow({ where: { id: locatario.locatarioId } });
    const corpo = JSON.stringify(res.body);
    for (const dado of [locatario.locatarioId, locatario.cpf, locatario.cnh, conta.nome, conta.email]) {
      expect(corpo).not.toContain(dado);
    }
  });

  it("mensagem do bloqueio existe em pt-BR, en e es", async () => {
    const { veiculo } = await veiculoComReservaPaga();
    const pt = await alterarStatus(veiculo.id, "MANUTENCAO", "pt-BR");
    const en = await alterarStatus(veiculo.id, "MANUTENCAO", "en");
    const es = await alterarStatus(veiculo.id, "MANUTENCAO", "es");
    expect(new Set([pt.body.message, en.body.message, es.body.message]).size).toBe(3);
    expect(en.body.message).toMatch(/booking/i);
    expect(es.body.message).toMatch(/reserva/i);
    expect([pt.body.code, en.body.code, es.body.code]).toEqual([CODIGO, CODIGO, CODIGO]);
  });
});
