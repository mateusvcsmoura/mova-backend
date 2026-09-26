import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  VALOR_DIARIA_PADRAO,
  createLocador,
  createLocatario,
  createReserva,
  createServico,
  createVeiculo,
  futurePeriod,
} from "../helpers";

// FINAL-H-01 — integridade financeira do período da reserva.
// Ataques independentes: nenhuma asserção deriva dos relatórios das tasks.

const CARTAO_OK = {
  numero: "4111111111111111",
  nome: "Teste Aprovado",
  validade: "12/30",
  cvv: "123",
};
const CARTAO_PROCESSANDO = {
  numero: "4111111111110001",
  nome: "Teste Pendente",
  validade: "12/30",
  cvv: "123",
};

const diarias = (inicio: Date, fim: Date) =>
  Math.max(1, Math.ceil((fim.getTime() - inicio.getTime()) / 86_400_000));

async function estadoBanco(idReserva: string) {
  const r = await prisma.reserva.findUniqueOrThrow({
    where: { id: idReserva },
  });
  return {
    inicio: r.dataHoraInicio.toISOString(),
    fim: r.dataHoraFim.toISOString(),
    valorTotal: Number(r.valorTotal),
    statusPagamento: r.statusPagamento,
    status: r.status,
    codigoDesbloqueio: r.codigoDesbloqueio,
  };
}

async function cenarioReserva(overrides: Record<string, unknown> = {}) {
  const locador = await createLocador();
  const locatario = await createLocatario();
  const veiculo = await createVeiculo(locador.token, locador.locadorId);
  const reserva = await createReserva(
    locatario.token,
    veiculo.id,
    locatario.locatarioId,
    overrides,
  );
  return { locador, locatario, veiculo, reserva };
}

describe("FINAL-H-01 — período x valor x status de pagamento", () => {
  it("reserva com pagamento SUCESSO recusa qualquer alteração de período", async () => {
    const { locatario, reserva } = await cenarioReserva();

    const pagamento = await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "CARTAO_CREDITO", cartao: CARTAO_OK });
    expect(pagamento.status).toBe(202);

    const antes = await estadoBanco(reserva.id);
    expect(antes.statusPagamento).toBe("SUCESSO");

    const novoPeriodo = futurePeriod(2, 29);

    const tentativas = [
      { dataHoraInicio: novoPeriodo.dataHoraInicio },
      { dataHoraFim: novoPeriodo.dataHoraFim },
      novoPeriodo,
    ];

    for (const corpo of tentativas) {
      const res = await request(app)
        .put(`/api/reserva/${reserva.id}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send(corpo);
      expect(res.status).toBe(409);

      const depois = await estadoBanco(reserva.id);
      expect(depois.inicio).toBe(antes.inicio);
      expect(depois.fim).toBe(antes.fim);
      expect(depois.valorTotal).toBe(antes.valorTotal);
      expect(depois.statusPagamento).toBe("SUCESSO");
    }
  });

  it("o LOCADOR dono também não consegue esticar o período de uma reserva paga", async () => {
    const { locador, locatario, reserva } = await cenarioReserva();

    await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "PIX" });

    const antes = await estadoBanco(reserva.id);
    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send(futurePeriod(2, 20));
    expect(res.status).toBe(409);
    expect(await estadoBanco(reserva.id)).toEqual(antes);
  });

  it("reserva em PROCESSANDO recusa alteração de período", async () => {
    const { locatario, reserva } = await cenarioReserva();

    const pagamento = await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        metodoPagamento: "CARTAO_CREDITO",
        cartao: CARTAO_PROCESSANDO,
      });
    expect(pagamento.status).toBe(202);

    const antes = await estadoBanco(reserva.id);
    expect(antes.statusPagamento).toBe("PROCESSANDO");

    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send(futurePeriod(2, 15));
    expect(res.status).toBe(409);
    expect(await estadoBanco(reserva.id)).toEqual(antes);
  });

  it("representação ISO equivalente do MESMO instante não é tratada como alteração", async () => {
    const { locatario, reserva } = await cenarioReserva();

    await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "PIX" });

    const antes = await estadoBanco(reserva.id);
    // Mesmo instante, escrito com offset explícito em vez de "Z".
    const mesmoInstanteOutroOffset = new Date(antes.fim)
      .toISOString()
      .replace("Z", "+00:00");

    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: mesmoInstanteOutroOffset });

    expect(res.status).toBe(200);
    expect(await estadoBanco(reserva.id)).toEqual(antes);
  });

  it("reserva não paga é reprecificada pelo SERVIDOR ao esticar e ao encurtar", async () => {
    const { locatario, reserva } = await cenarioReserva();

    const inicial = await estadoBanco(reserva.id);
    expect(inicial.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");

    const maior = futurePeriod(1, 10);
    const resMaior = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send(maior);
    expect(resMaior.status).toBe(200);

    const depoisMaior = await estadoBanco(reserva.id);
    const esperadoMaior =
      VALOR_DIARIA_PADRAO *
      diarias(new Date(maior.dataHoraInicio), new Date(maior.dataHoraFim));
    expect(depoisMaior.valorTotal).toBeCloseTo(esperadoMaior, 2);
    expect(depoisMaior.valorTotal).toBeGreaterThan(inicial.valorTotal);

    const menor = futurePeriod(1, 1);
    const resMenor = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send(menor);
    expect(resMenor.status).toBe(200);

    const depoisMenor = await estadoBanco(reserva.id);
    const esperadoMenor =
      VALOR_DIARIA_PADRAO *
      diarias(new Date(menor.dataHoraInicio), new Date(menor.dataHoraFim));
    expect(depoisMenor.valorTotal).toBeCloseTo(esperadoMenor, 2);
    expect(depoisMenor.valorTotal).toBeLessThan(depoisMaior.valorTotal);
  });

  it("valorTotal enviado pelo cliente é ignorado; o servidor recalcula", async () => {
    const { locatario, reserva } = await cenarioReserva();
    const periodo = futurePeriod(1, 5);

    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ ...periodo, valorTotal: 1 });
    expect(res.status).toBe(200);

    const estado = await estadoBanco(reserva.id);
    expect(estado.valorTotal).toBeCloseTo(
      VALOR_DIARIA_PADRAO *
        diarias(
          new Date(periodo.dataHoraInicio),
          new Date(periodo.dataHoraFim),
        ),
      2,
    );
  });

  it("statusPagamento/status/codigoDesbloqueio não são controláveis pelo PUT", async () => {
    const { locatario, reserva } = await cenarioReserva();
    const antes = await estadoBanco(reserva.id);

    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        metodoPagamento: "PIX",
        statusPagamento: "SUCESSO",
        status: "CONFIRMADA",
        codigoDesbloqueio: "AAAA-BBBB",
        valorTotal: 0,
      });
    expect(res.status).toBe(200);

    const depois = await estadoBanco(reserva.id);
    expect(depois.statusPagamento).toBe(antes.statusPagamento);
    expect(depois.status).toBe(antes.status);
    expect(depois.codigoDesbloqueio).toBe(antes.codigoDesbloqueio);
    expect(depois.valorTotal).toBe(antes.valorTotal);
  });

  it("repricing preserva o snapshot dos serviços opcionais contratados", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const servico = await createServico({ valor: 80 });

    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      { servicosIds: [servico.id] },
    );

    const inicial = await estadoBanco(reserva.id);
    expect(inicial.valorTotal).toBeCloseTo(VALOR_DIARIA_PADRAO * 2 + 80, 2);

    // Preço do catálogo muda depois da contratação.
    await prisma.servicoOpcional.update({
      where: { id: servico.id },
      data: { valor: 500 },
    });

    const periodo = futurePeriod(1, 4);
    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send(periodo);
    expect(res.status).toBe(200);

    const depois = await estadoBanco(reserva.id);
    expect(depois.valorTotal).toBeCloseTo(
      VALOR_DIARIA_PADRAO *
        diarias(
          new Date(periodo.dataHoraInicio),
          new Date(periodo.dataHoraFim),
        ) +
        80,
      2,
    );
  });

  it("reserva existente mantém a diária contratada; nova reserva usa a nova diária", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const antiga = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
    );
    const antesDoReajuste = await estadoBanco(antiga.id);

    const reajuste = await request(app)
      .patch(`/api/veiculo/modelos/${veiculo.modeloVeiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ valorDiaria: 999.99 });
    expect(reajuste.status).toBe(200);

    expect(await estadoBanco(antiga.id)).toEqual(antesDoReajuste);

    const outroVeiculo = await createVeiculo(locador.token, locador.locadorId);
    await prisma.veiculo.update({
      where: { id: outroVeiculo.id },
      data: { idModeloVeiculo: veiculo.modeloVeiculo.id },
    });

    const nova = await createReserva(
      locatario.token,
      outroVeiculo.id,
      locatario.locatarioId,
      futurePeriod(20, 1),
    );
    const estadoNova = await estadoBanco(nova.id);
    expect(estadoNova.valorTotal).toBeCloseTo(999.99, 2);
  });

  it("CROSS-05: mudança de catálogo/garagem não altera reserva já paga", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
    );

    await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "PIX" });

    const pago = await estadoBanco(reserva.id);
    expect(pago.statusPagamento).toBe("SUCESSO");

    await request(app)
      .patch(`/api/veiculo/modelos/${veiculo.modeloVeiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ valorDiaria: 1 });

    const novaGaragem = await request(app)
      .post("/api/garagem")
      .set("Authorization", `Bearer ${locador.token}`)
      .send({
        idLocador: locador.locadorId,
        nome: "Garagem destino cross05",
        endereco: "Rua B, 2",
        capacidade: 5,
      });
    await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ garagemId: novaGaragem.body.result.id });

    expect(await estadoBanco(reserva.id)).toEqual(pago);
  });
});

describe("FINAL-H-01 — concorrência entre alteração de período e pagamento", () => {
  it("nunca permite período novo com valor/cobrança antigos (10 rodadas)", async () => {
    for (let rodada = 0; rodada < 10; rodada++) {
      const locador = await createLocador();
      const locatario = await createLocatario();
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const reserva = await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
      );

      const novoPeriodo = futurePeriod(1, 7);

      const [put, pagamento] = await Promise.allSettled([
        request(app)
          .put(`/api/reserva/${reserva.id}`)
          .set("Authorization", `Bearer ${locatario.token}`)
          .send(novoPeriodo),
        request(app)
          .post(`/api/reserva/${reserva.id}/pagamento`)
          .set("Authorization", `Bearer ${locatario.token}`)
          .send({ metodoPagamento: "PIX" }),
      ]);

      expect(put.status).toBe("fulfilled");
      expect(pagamento.status).toBe("fulfilled");

      const final = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
        include: { veiculo: { include: { modeloVeiculo: true } } },
      });

      const valorEsperado =
        Number(final.veiculo.modeloVeiculo.valorDiaria) *
        diarias(final.dataHoraInicio, final.dataHoraFim);

      // INVARIANTE: o valor persistido sempre corresponde ao período persistido.
      expect(Number(final.valorTotal)).toBeCloseTo(valorEsperado, 2);

      // INVARIANTE: a cobrança registrada cobre exatamente o valor da reserva.
      const cobrancas = await prisma.cobrancaReserva.findMany({
        where: { idReserva: reserva.id, tipo: "PAGAMENTO_RESERVA" },
      });
      if (final.statusPagamento === "SUCESSO") {
        expect(cobrancas.length).toBe(1);
        expect(Number(cobrancas[0].valor)).toBeCloseTo(
          Number(final.valorTotal),
          2,
        );
      }
    }
  });
});
