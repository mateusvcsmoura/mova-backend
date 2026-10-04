import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  confirmarPagamentoWebhook,
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Task 10.1 — Bug B (D10.1-07/08): garagem ainda necessária a uma reserva
// confirmada (retirada ainda não feita, ou devolução ainda pendente) não vai
// para MANUTENCAO/INATIVA. Nada é cancelado nem remanejado.

const CODIGO = "GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const DIA = 24 * 60 * 60 * 1000;

describe("Task 10.1 — Bug B: garagem com reserva futura confirmada (RF19)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  const statusGaragem = (id: string, status: string, idioma = "pt-BR") =>
    request(app).put(`/api/garagem/${id}`).set(auth(locador.token)).set("Accept-Language", idioma).send({ status });
  const excluirGaragem = (id: string) => request(app).delete(`/api/garagem/${id}`).set(auth(locador.token));

  // Reserva com retirada na garagem do veículo (A) e devolução em B.
  async function reserva(opts: { paga?: boolean; mesmaGaragem?: boolean } = {}) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const retirada = veiculo.garagemId as string;
    const devolucao = opts.mesmaGaragem ? retirada : (await createGaragem(locador.token, locador.locadorId)).id;
    const r = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, {
      ...futurePeriod(3, 2),
      idGaragemDevolucao: devolucao,
    });
    if (opts.paga !== false) await confirmarPagamentoWebhook(r.id, { provider: "mercadopago" });
    return { veiculo, retirada, devolucao, id: r.id as string };
  }

  const setReserva = (id: string, data: Record<string, unknown>) => prisma.reserva.update({ where: { id }, data });

  it("garagem sem compromisso pode ir a MANUTENCAO e INATIVA (PUT e exclusão lógica)", async () => {
    const a = await createGaragem(locador.token, locador.locadorId);
    expect((await statusGaragem(a.id, "MANUTENCAO")).status).toBe(200);
    expect((await statusGaragem(a.id, "INATIVA")).status).toBe(200);
    const b = await createGaragem(locador.token, locador.locadorId);
    expect((await excluirGaragem(b.id)).status).toBe(204);
  });

  it("reserva futura confirmada protege retirada e devolução; nada muda e não há PII no erro", async () => {
    const r = await reserva();
    const antes = await prisma.reserva.findUniqueOrThrow({ where: { id: r.id } });
    expect(antes.status).toBe("CONFIRMADA");

    for (const garagem of [r.retirada, r.devolucao]) {
      for (const status of ["MANUTENCAO", "INATIVA"]) {
        const res = await statusGaragem(garagem, status);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe(CODIGO);
        const corpo = JSON.stringify(res.body);
        expect(corpo).not.toContain(locatario.locatarioId);
        expect(corpo).not.toContain(locatario.cpf);
        expect(corpo).not.toContain(r.id);
      }
      const del = await excluirGaragem(garagem);
      expect(del.status).toBe(409);
      expect(del.body.code).toBe(CODIGO);
      expect((await prisma.garagem.findUniqueOrThrow({ where: { id: garagem } })).status).toBe("ATIVA");
    }
    const depois = await prisma.reserva.findUniqueOrThrow({ where: { id: r.id } });
    expect(depois).toMatchObject({
      status: "CONFIRMADA",
      idGaragemRetirada: antes.idGaragemRetirada,
      idGaragemDevolucao: antes.idGaragemDevolucao,
      codigoDesbloqueio: antes.codigoDesbloqueio,
    });
    expect(await prisma.eventoFinanceiroSandbox.count({ where: { idReserva: r.id, tipo: "ESTORNO_SOLICITADO" } })).toBe(0);
  });

  it("EM_ANDAMENTO: retirada já feita libera a garagem de retirada; a de devolução segue protegida", async () => {
    const r = await reserva();
    await setReserva(r.id, { status: "EM_ANDAMENTO", codigoUsadoEm: new Date() });
    expect((await statusGaragem(r.retirada, "MANUTENCAO")).status).toBe(200);
    expect((await statusGaragem(r.devolucao, "MANUTENCAO")).status).toBe(409);
  });

  it("EM_ANDAMENTO com devolução atrasada continua protegendo a garagem de devolução", async () => {
    const r = await reserva();
    await setReserva(r.id, {
      status: "EM_ANDAMENTO",
      codigoUsadoEm: new Date(Date.now() - 3 * DIA),
      dataHoraInicio: new Date(Date.now() - 3 * DIA),
      dataHoraFim: new Date(Date.now() - DIA),
    });
    expect((await statusGaragem(r.devolucao, "INATIVA")).status).toBe(409);
  });

  it("mesma garagem de retirada e devolução: protegida antes e durante, sem duplicar o erro", async () => {
    const r = await reserva({ mesmaGaragem: true });
    const res = await statusGaragem(r.retirada, "MANUTENCAO");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(CODIGO);
    await setReserva(r.id, { status: "EM_ANDAMENTO", codigoUsadoEm: new Date() });
    expect((await statusGaragem(r.retirada, "MANUTENCAO")).status).toBe(409);
  });

  it("devolução não informada: a garagem de retirada recebe o veículo de volta e segue protegida durante a locação", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const r = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(3, 2));
    await confirmarPagamentoWebhook(r.id, { provider: "mercadopago" });
    await setReserva(r.id, { status: "EM_ANDAMENTO", codigoUsadoEm: new Date(), idGaragemDevolucao: null });
    expect((await statusGaragem(veiculo.garagemId, "MANUTENCAO")).status).toBe(409);
  });

  it("concluída, cancelada, expirada e não paga não protegem", async () => {
    const realizada = await reserva();
    await setReserva(realizada.id, { status: "REALIZADA", codigoUsadoEm: new Date(), devolvidoEm: new Date() });
    expect((await statusGaragem(realizada.retirada, "MANUTENCAO")).status).toBe(200);
    expect((await statusGaragem(realizada.devolucao, "MANUTENCAO")).status).toBe(200);

    const cancelada = await reserva();
    await request(app).post(`/api/reserva/${cancelada.id}/cancelar`).set(auth(locador.token));
    expect((await statusGaragem(cancelada.retirada, "INATIVA")).status).toBe(200);
    expect((await statusGaragem(cancelada.devolucao, "INATIVA")).status).toBe(200);

    const naoPaga = await reserva({ paga: false });
    expect((await statusGaragem(naoPaga.devolucao, "MANUTENCAO")).status).toBe(200);

    const expirada = await reserva({ paga: false });
    await setReserva(expirada.id, { criadaEm: new Date(Date.now() - 16 * 60 * 1000) });
    expect((await statusGaragem(expirada.retirada, "MANUTENCAO")).status).toBe(200);

    const passada = await reserva();
    await setReserva(passada.id, { dataHoraInicio: new Date(Date.now() - 3 * DIA), dataHoraFim: new Date(Date.now() - 2 * DIA) });
    expect((await statusGaragem(passada.retirada, "MANUTENCAO")).status).toBe(200);
  });

  it("uma reserva protegida entre várias não protegidas basta para o 409", async () => {
    const devolucao = (await createGaragem(locador.token, locador.locadorId)).id;
    for (let i = 0; i < 3; i++) {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const r = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, { ...futurePeriod(5 + i, 1), idGaragemDevolucao: devolucao });
      if (i === 1) await confirmarPagamentoWebhook(r.id, { provider: "mercadopago" });
      if (i === 2) await request(app).post(`/api/reserva/${r.id}/cancelar`).set(auth(locador.token));
    }
    expect((await statusGaragem(devolucao, "MANUTENCAO")).status).toBe(409);
  });

  it("outras edições e o próprio status atual continuam livres; mensagem em pt-BR, en e es", async () => {
    const r = await reserva();
    expect((await request(app).put(`/api/garagem/${r.retirada}`).set(auth(locador.token)).send({ nome: "Garagem renomeada" })).status).toBe(200);
    expect((await statusGaragem(r.retirada, "ATIVA")).status).toBe(200);
    const msgs = await Promise.all(["pt-BR", "en", "es"].map(async (l) => (await statusGaragem(r.retirada, "MANUTENCAO", l)).body.message));
    expect(new Set(msgs).size).toBe(3);
    expect(msgs[1]).toMatch(/booking/i);
  });

  it("corrida confirmação de pagamento × garagem em manutenção nunca deixa reserva paga com garagem indisponível", async () => {
    for (let i = 0; i < 6; i++) {
      const r = await reserva({ paga: false });
      const [, garagem] = await Promise.all([
        request(app).post(`/api/reserva/${r.id}/pagamento`).set(auth(locatario.token)).send({ metodoPagamento: "PIX" }),
        statusGaragem(r.devolucao, "MANUTENCAO"),
      ]);
      const final = await prisma.reserva.findUniqueOrThrow({ where: { id: r.id } });
      const g = await prisma.garagem.findUniqueOrThrow({ where: { id: r.devolucao } });
      expect(final.statusPagamento === "SUCESSO" && g.status !== "ATIVA").toBe(false);
      if (final.statusPagamento === "SUCESSO") expect(garagem.status).toBe(409);
      else expect(final.codigoDesbloqueio).toBeNull();
    }
  });
});
