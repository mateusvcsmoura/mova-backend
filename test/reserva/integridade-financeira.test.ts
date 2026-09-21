import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  confirmarPagamentoWebhook,
  createLocador,
  createLocatario,
  createReserva,
  createServico,
  createVeiculo,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const DIA_MS = 24 * 60 * 60 * 1000;

function periodo(inicioEmDias: number, duracaoEmDias: number) {
  const inicio = new Date(Date.now() + inicioEmDias * DIA_MS);
  inicio.setMilliseconds(0);
  const fim = new Date(inicio.getTime() + duracaoEmDias * DIA_MS);
  return { dataHoraInicio: inicio.toISOString(), dataHoraFim: fim.toISOString() };
}

describe("FINAL-H-01 — integridade financeira da alteração de reserva", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outroLocatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outroLocatario = await createLocatario();
  });

  async function criarReserva(
    inicioEmDias: number,
    duracaoEmDias: number,
    servicosIds?: string[],
  ) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const criada = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      { ...periodo(inicioEmDias, duracaoEmDias), ...(servicosIds ? { servicosIds } : {}) },
    );
    expect(criada?.id).toBeTruthy();
    return { veiculo, criada };
  }

  async function pagarViaWebhook(idReserva: string) {
    const resposta = await confirmarPagamentoWebhook(idReserva);
    expect(resposta.status).toBe(200);
  }

  it("rejeita extensão do fim de uma reserva já paga e preserva o snapshot", async () => {
    const { criada } = await criarReserva(40, 1);
    await pagarViaWebhook(criada.id);

    const antes = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      select: { dataHoraInicio: true, dataHoraFim: true, valorTotal: true, statusPagamento: true },
    });
    const novoFim = new Date(antes.dataHoraFim.getTime() + 29 * DIA_MS);

    const resposta = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: novoFim.toISOString() });

    expect(resposta.status).toBe(409);
    expect(resposta.body.message).toBe("Não é possível alterar o período de uma reserva já paga.");

    const depois = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      select: { dataHoraInicio: true, dataHoraFim: true, valorTotal: true, statusPagamento: true },
    });
    expect(depois.dataHoraInicio.getTime()).toBe(antes.dataHoraInicio.getTime());
    expect(depois.dataHoraFim.getTime()).toBe(antes.dataHoraFim.getTime());
    expect(Number(depois.valorTotal)).toBe(Number(antes.valorTotal));
    expect(depois.statusPagamento).toBe("SUCESSO");
  });

  it("preserva serviços associados quando a reserva paga tenta mudar o período", async () => {
    const servico = await createServico({ valor: 37.45 });
    const { criada } = await criarReserva(45, 1, [servico.id]);
    await pagarViaWebhook(criada.id);

    const antes = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      include: { servicos: true },
    });
    const resposta = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: new Date(antes.dataHoraFim.getTime() + DIA_MS).toISOString() });

    expect(resposta.status).toBe(409);
    const depois = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      include: { servicos: true },
    });
    expect(depois.servicos.map((item) => ({ idServico: item.idServico, valor: Number(item.valor) }))).toEqual(
      antes.servicos.map((item) => ({ idServico: item.idServico, valor: Number(item.valor) })),
    );
  });

  it.each(["inicio", "fim", "ambas"])(
    "rejeita alteração efetiva somente no período pago (%s)",
    async (tipo) => {
      const { criada } = await criarReserva(50 + ["inicio", "fim", "ambas"].indexOf(tipo) * 10, 1);
      await pagarViaWebhook(criada.id);
      const original = await prisma.reserva.findUniqueOrThrow({
        where: { id: criada.id },
        select: { dataHoraInicio: true, dataHoraFim: true },
      });
      const inicio = new Date(original.dataHoraInicio.getTime() - DIA_MS);
      const fim = new Date(original.dataHoraFim.getTime() + DIA_MS);
      const body =
        tipo === "inicio"
          ? { dataHoraInicio: inicio.toISOString() }
          : tipo === "fim"
            ? { dataHoraFim: fim.toISOString() }
            : { dataHoraInicio: inicio.toISOString(), dataHoraFim: fim.toISOString() };

      const resposta = await request(app)
        .put(`/api/reserva/${criada.id}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send(body);

      expect(resposta.status).toBe(409);
    },
  );

  it("aceita reenvio das mesmas datas, inclusive em ISO equivalente", async () => {
    const { criada } = await criarReserva(90, 1);
    await pagarViaWebhook(criada.id);
    const original = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      select: { dataHoraInicio: true, dataHoraFim: true },
    });

    const equivalente = (data: Date) => data.toISOString().replace("Z", "+00:00");
    const resposta = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        dataHoraInicio: equivalente(original.dataHoraInicio),
        dataHoraFim: equivalente(original.dataHoraFim),
      });

    expect(resposta.status).toBe(200);
    expect(new Date(resposta.body.result.dataHoraInicio).getTime()).toBe(original.dataHoraInicio.getTime());
    expect(new Date(resposta.body.result.dataHoraFim).getTime()).toBe(original.dataHoraFim.getTime());
  });

  it("recalcula o valor de reserva não paga ao aumentar e reduzir o período", async () => {
    const servico = await createServico({ valor: 37.45 });
    const { criada } = await criarReserva(110, 1, [servico.id]);
    expect(criada.valorTotal).toBe(125.25 + 37.45);
    const inicio = new Date(criada.dataHoraInicio);

    const aumentada = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: new Date(inicio.getTime() + 3 * DIA_MS).toISOString() });

    expect(aumentada.status).toBe(200);
    expect(aumentada.body.result.valorTotal).toBe(125.25 * 3 + 37.45);
    expect(aumentada.body.result.servicos).toEqual(
      expect.arrayContaining([expect.objectContaining({ idServico: servico.id, valor: 37.45 })]),
    );

    const reduzida = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: new Date(inicio.getTime() + DIA_MS).toISOString() });

    expect(reduzida.status).toBe(200);
    expect(reduzida.body.result.valorTotal).toBe(125.25 + 37.45);
  });

  it("não permite controlar valorTotal por mass assignment", async () => {
    const { criada } = await criarReserva(140, 1);
    const inicio = new Date(criada.dataHoraInicio);
    const resposta = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: new Date(inicio.getTime() + 2 * DIA_MS).toISOString(), valorTotal: 1 });

    expect(resposta.status).toBe(200);
    expect(resposta.body.result.valorTotal).toBe(125.25 * 2);
  });

  it("rejeita alteração de período quando o pagamento está PROCESSANDO", async () => {
    const { criada } = await criarReserva(170, 1);
    const pagamento = await request(app)
      .post(`/api/reserva/${criada.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        metodoPagamento: "CARTAO_CREDITO",
        cartao: { numero: "4111111111110001", nome: "FULANO DE TAL", validade: "12/30", cvv: "123" },
      });
    expect(pagamento.status).toBe(202);
    expect(pagamento.body.result.reserva.statusPagamento).toBe("PROCESSANDO");

    const original = await prisma.reserva.findUniqueOrThrow({ where: { id: criada.id }, select: { dataHoraFim: true } });
    const resposta = await request(app)
      .put(`/api/reserva/${criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: new Date(original.dataHoraFim.getTime() + DIA_MS).toISOString() });

    expect(resposta.status).toBe(409);
  });

  it("preserva ownership e bloqueia overlap durante alteração", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const primeiro = {
      criada: await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
        periodo(210, 2),
      ),
    };
    const segundo = {
      criada: await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
        periodo(220, 2),
      ),
    };
    const periodoPrimeiro = await prisma.reserva.findUniqueOrThrow({
      where: { id: primeiro.criada.id },
      select: { dataHoraInicio: true, dataHoraFim: true },
    });
    const overlap = await request(app)
      .put(`/api/reserva/${segundo.criada.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        dataHoraInicio: periodoPrimeiro.dataHoraInicio.toISOString(),
        dataHoraFim: periodoPrimeiro.dataHoraFim.toISOString(),
      });
    expect(overlap.status).toBe(409);

    const deOutro = await request(app)
      .put(`/api/reserva/${primeiro.criada.id}`)
      .set("Authorization", `Bearer ${outroLocatario.token}`)
      .send({ dataHoraFim: new Date(periodoPrimeiro.dataHoraFim.getTime() + DIA_MS).toISOString() });
    expect(deOutro.status).toBe(403);
  });

  it("mantém consistência quando pagamento e alteração concorrem", async () => {
    const { criada } = await criarReserva(260, 1);
    const antes = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      select: { dataHoraInicio: true, dataHoraFim: true, valorTotal: true },
    });
    const novoFim = new Date(antes.dataHoraFim.getTime() + 2 * DIA_MS);

    const [atualizacao, pagamento] = await Promise.all([
      request(app)
        .put(`/api/reserva/${criada.id}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ dataHoraFim: novoFim.toISOString() }),
      request(app)
        .post(`/api/reserva/${criada.id}/pagamento`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ metodoPagamento: "PIX" }),
    ]);

    expect(pagamento.status).toBe(202);
    const final = await prisma.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      select: { dataHoraInicio: true, dataHoraFim: true, valorTotal: true, statusPagamento: true },
    });
    expect(final.statusPagamento).toBe("SUCESSO");

    const alterouAntesDoPagamento = atualizacao.status === 200;
    if (alterouAntesDoPagamento) {
      expect(final.dataHoraFim.getTime()).toBe(novoFim.getTime());
      expect(Number(final.valorTotal)).toBe(125.25 * 3);
    } else {
      expect(atualizacao.status).toBe(409);
      expect(final.dataHoraFim.getTime()).toBe(antes.dataHoraFim.getTime());
      expect(Number(final.valorTotal)).toBe(Number(antes.valorTotal));
    }

    const cobranca = await prisma.cobrancaReserva.findFirstOrThrow({
      where: { idReserva: criada.id, tipo: "PAGAMENTO_RESERVA" },
    });
    expect(Number(cobranca.valor)).toBe(Number(final.valorTotal));
  });
});
