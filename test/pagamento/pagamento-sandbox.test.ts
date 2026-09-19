import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { env } from "../../src/config/env";
import {
  assinarWebhook,
  confirmarPagamentoWebhook,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  LocadorContext,
  LocatarioContext,
  VALOR_DIARIA_PADRAO,
} from "../helpers";

// TASK 04 — fluxo de pagamento em sandbox.
//
// O desenho sob teste: o cliente NUNCA declara o resultado. Ele envia dados de
// teste; o backend decide o desfecho, registra a cobrança, deixa PROCESSANDO e
// entrega o evento ao simulador de gateway, que assina um webhook e o devolve
// pelo mesmo caminho de um gateway real (verificação de assinatura inclusa).
//
// Ver auditoria/PAGAMENTO.md.

// Cartões de teste: o sufixo decide o desfecho, como nos sandboxes reais.
const CARTAO_APROVADO = "4111111111111234";
const CARTAO_RECUSADO = "4111111111110000";
const CARTAO_PENDENTE = "4111111111110001";

const cartao = (numero: string) => ({
  numero,
  nome: "FULANO DE TAL",
  validade: "12/30",
  cvv: "123",
});

describe("Pagamento — sandbox", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  // Cada reserva usa um veículo próprio para não colidir períodos.
  // futurePeriod(_, 2) = 2 diárias.
  let deslocamento = 40;
  async function novaReserva() {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    deslocamento += 1;
    return createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(deslocamento, 2),
    );
  }

  function pagar(
    idReserva: string,
    body: Record<string, unknown>,
    token = locatario.token,
  ) {
    return request(app)
      .post(`/api/reserva/${idReserva}/pagamento`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  const noBanco = (id: string) =>
    prisma.reserva.findUniqueOrThrow({ where: { id } });

  // 1. Pagamento aprovado
  it("pagamento aprovado: confirma a reserva e gera o código de desbloqueio", async () => {
    const reserva = await novaReserva();
    expect(reserva.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");

    const res = await pagar(reserva.id, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: cartao(CARTAO_APROVADO),
    });

    expect(res.status).toBe(202);
    expect(res.body.result.reserva.statusPagamento).toBe("SUCESSO");
    expect(res.body.result.reserva.status).toBe("CONFIRMADA");

    const persistida = await noBanco(reserva.id);
    expect(persistida.statusPagamento).toBe("SUCESSO");
    expect(persistida.status).toBe("CONFIRMADA");
    expect(persistida.metodoPagamento).toBe("CARTAO_CREDITO");
    expect(persistida.codigoDesbloqueio).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(persistida.codigoGeradoEm).not.toBeNull();
  });

  it("PIX aprova sem exigir cartão", async () => {
    const reserva = await novaReserva();
    const res = await pagar(reserva.id, { metodoPagamento: "PIX" });

    expect(res.status).toBe(202);
    expect((await noBanco(reserva.id)).statusPagamento).toBe("SUCESSO");
  });

  // 2. Pagamento recusado
  it("pagamento recusado: FALHA, sem código e sem confirmar a reserva", async () => {
    const reserva = await novaReserva();

    const res = await pagar(reserva.id, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: cartao(CARTAO_RECUSADO),
    });

    expect(res.status).toBe(202);

    const persistida = await noBanco(reserva.id);
    expect(persistida.statusPagamento).toBe("FALHA");
    expect(persistida.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(persistida.codigoDesbloqueio).toBeNull();
  });

  it("recusado pode ser repetido com outro cartão e então aprova", async () => {
    const reserva = await novaReserva();

    await pagar(reserva.id, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: cartao(CARTAO_RECUSADO),
    });
    const res = await pagar(reserva.id, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: cartao(CARTAO_APROVADO),
    });

    expect(res.status).toBe(202);
    expect((await noBanco(reserva.id)).statusPagamento).toBe("SUCESSO");
  });

  // Pendente (análise antifraude)
  it("cartão pendente: fica PROCESSANDO, sem webhook e sem código", async () => {
    const reserva = await novaReserva();

    const res = await pagar(reserva.id, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: cartao(CARTAO_PENDENTE),
    });

    expect(res.status).toBe(202);
    expect(res.body.result.reserva.statusPagamento).toBe("PROCESSANDO");

    const persistida = await noBanco(reserva.id);
    expect(persistida.statusPagamento).toBe("PROCESSANDO");
    expect(persistida.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(persistida.codigoDesbloqueio).toBeNull();
  });

  // 3. Webhook inválido
  it("webhook com corpo inválido: 400", async () => {
    const provider = env.PAGAMENTO_SANDBOX_PROVIDER;
    const corpo = "isto nao e json";

    const res = await request(app)
      .post(`/api/webhooks/pagamento/${provider}`)
      .set("x-mp-signature", assinarWebhook(provider, corpo))
      .set("Content-Type", "application/json")
      .send(corpo);

    expect(res.status).toBe(400);
  });

  it("webhook com evento desconhecido: 400 e nenhum efeito", async () => {
    const reserva = await novaReserva();

    const res = await confirmarPagamentoWebhook(reserva.id, {
      provider: env.PAGAMENTO_SANDBOX_PROVIDER,
      evento: "pagamento.inexistente",
    });

    expect(res.status).toBe(400);
    expect((await noBanco(reserva.id)).statusPagamento).toBe(
      "AGUARDANDO_PAGAMENTO",
    );
  });

  // 4. Assinatura inválida
  it("assinatura inválida: 401 e estado intacto", async () => {
    const reserva = await novaReserva();

    const res = await confirmarPagamentoWebhook(reserva.id, {
      provider: env.PAGAMENTO_SANDBOX_PROVIDER,
      assinatura: "f".repeat(64),
    });

    expect(res.status).toBe(401);

    const persistida = await noBanco(reserva.id);
    expect(persistida.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    expect(persistida.codigoDesbloqueio).toBeNull();
  });

  it("assinatura ausente: 401", async () => {
    const reserva = await novaReserva();
    const provider = env.PAGAMENTO_SANDBOX_PROVIDER;
    const corpo = JSON.stringify({
      idReserva: reserva.id,
      evento: "pagamento.sucesso",
    });

    const res = await request(app)
      .post(`/api/webhooks/pagamento/${provider}`)
      .set("Content-Type", "application/json")
      .send(corpo);

    expect(res.status).toBe(401);
    expect((await noBanco(reserva.id)).statusPagamento).toBe(
      "AGUARDANDO_PAGAMENTO",
    );
  });

  // 5. Webhook duplicado
  it("webhook duplicado: não regera o código nem reconfirma", async () => {
    const reserva = await novaReserva();
    const provider = env.PAGAMENTO_SANDBOX_PROVIDER;

    const primeiro = await confirmarPagamentoWebhook(reserva.id, { provider });
    expect(primeiro.status).toBe(200);

    const depoisDoPrimeiro = await noBanco(reserva.id);
    expect(depoisDoPrimeiro.codigoDesbloqueio).not.toBeNull();

    const segundo = await confirmarPagamentoWebhook(reserva.id, { provider });
    expect(segundo.status).toBe(200);

    const depoisDoSegundo = await noBanco(reserva.id);
    // Idempotência: mesmo código, mesmo instante de geração.
    expect(depoisDoSegundo.codigoDesbloqueio).toBe(
      depoisDoPrimeiro.codigoDesbloqueio,
    );
    expect(depoisDoSegundo.codigoGeradoEm?.getTime()).toBe(
      depoisDoPrimeiro.codigoGeradoEm?.getTime(),
    );
    expect(depoisDoSegundo.status).toBe("CONFIRMADA");
  });

  // 6. Pagamento duplicado
  it("iniciar pagamento de reserva já aprovada: 409 e nenhuma cobrança extra", async () => {
    const reserva = await novaReserva();

    const primeiro = await pagar(reserva.id, { metodoPagamento: "PIX" });
    expect(primeiro.status).toBe(202);

    const antes = await noBanco(reserva.id);

    const segundo = await pagar(reserva.id, { metodoPagamento: "PIX" });
    expect(segundo.status).toBe(409);

    const depois = await noBanco(reserva.id);
    expect(depois.codigoDesbloqueio).toBe(antes.codigoDesbloqueio);

    const cobrancas = await prisma.cobrancaReserva.count({
      where: { idReserva: reserva.id, tipo: "PAGAMENTO_RESERVA" },
    });
    expect(cobrancas).toBe(1);
  });

  it("iniciar pagamento de reserva cancelada: 409", async () => {
    const reserva = await novaReserva();
    await request(app)
      .post(`/api/reserva/${reserva.id}/cancelar`)
      .set("Authorization", `Bearer ${locatario.token}`);

    const res = await pagar(reserva.id, { metodoPagamento: "PIX" });
    expect(res.status).toBe(409);
  });

  // 7. Reserva inexistente
  it("reserva inexistente: 404", async () => {
    const res = await pagar("11111111-2222-4333-8444-555555555555", {
      metodoPagamento: "PIX",
    });
    expect(res.status).toBe(404);
  });

  it("id malformado: 400", async () => {
    const res = await pagar("nao-e-uuid", { metodoPagamento: "PIX" });
    expect(res.status).toBe(400);
  });

  it("locatário que não é dono: 403", async () => {
    const reserva = await novaReserva();
    const intruso = await createLocatario();

    const res = await pagar(
      reserva.id,
      { metodoPagamento: "PIX" },
      intruso.token,
    );
    expect(res.status).toBe(403);
  });

  // 8. Valor inconsistente
  it("valor enviado pelo cliente é ignorado: cobra o valor da reserva", async () => {
    const reserva = await novaReserva();
    const valorReal = VALOR_DIARIA_PADRAO * 2;
    expect(Number(reserva.valorTotal)).toBe(valorReal);

    const res = await pagar(reserva.id, {
      metodoPagamento: "PIX",
      // Tentativa de forjar valor e status pelo cliente.
      valor: 1,
      valorTotal: 1,
      statusPagamento: "SUCESSO",
      status: "CONFIRMADA",
    });

    expect(res.status).toBe(202);
    expect(res.body.result.valorCobrado).toBe(valorReal);

    const cobranca = await prisma.cobrancaReserva.findFirstOrThrow({
      where: { idReserva: reserva.id, tipo: "PAGAMENTO_RESERVA" },
    });
    expect(Number(cobranca.valor)).toBe(valorReal);
    expect(Number((await noBanco(reserva.id)).valorTotal)).toBe(valorReal);
  });

  // 9. Método inválido
  it("método de pagamento inválido: 400", async () => {
    const reserva = await novaReserva();
    const res = await pagar(reserva.id, { metodoPagamento: "BOLETO" });

    expect(res.status).toBe(400);
    expect((await noBanco(reserva.id)).statusPagamento).toBe(
      "AGUARDANDO_PAGAMENTO",
    );
  });

  it("método ausente: 400", async () => {
    const reserva = await novaReserva();
    expect((await pagar(reserva.id, {})).status).toBe(400);
  });

  it("cartão obrigatório ausente: 400 e reserva não entra em PROCESSANDO", async () => {
    const reserva = await novaReserva();

    const res = await pagar(reserva.id, { metodoPagamento: "CARTAO_DEBITO" });

    expect(res.status).toBe(400);
    const persistida = await noBanco(reserva.id);
    expect(persistida.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    expect(persistida.metodoPagamento).toBeNull();
  });

  it("número de cartão inválido: 400", async () => {
    const reserva = await novaReserva();

    const res = await pagar(reserva.id, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: cartao("4111"),
    });

    expect(res.status).toBe(400);
    expect((await noBanco(reserva.id)).statusPagamento).toBe(
      "AGUARDANDO_PAGAMENTO",
    );
  });

  it("sem autenticação: 401", async () => {
    const reserva = await novaReserva();
    const res = await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .send({ metodoPagamento: "PIX" });

    expect(res.status).toBe(401);
  });
});
