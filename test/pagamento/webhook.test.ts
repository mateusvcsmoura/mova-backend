import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { SandboxPaymentAudit } from "../../src/infra/payment/sandbox-audit";
import {
  assinarWebhook,
  confirmarPagamentoWebhook,
  createAccount,
  createBloqueio,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Webhook assinado do gateway de pagamento: é o ÚNICO caminho que confirma
// pagamento. Cobre assinatura válida/ inválida, provider desconhecido e o fato
// de o cliente não poder mais setar statusPagamento direto.
describe("Webhook de pagamento (assinado)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  async function novaReserva(diasInicio = 5) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(diasInicio, 2),
    );
    return reserva.id as string;
  }

  it("assinatura válida confirma pagamento e gera código", async () => {
    const id = await novaReserva();

    const res = await confirmarPagamentoWebhook(id, { metodo: "PIX" });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const reserva = await prisma.reserva.findUnique({ where: { id } });
    expect(reserva!.statusPagamento).toBe("SUCESSO");
    expect(reserva!.metodoPagamento).toBe("PIX");
    expect(reserva!.codigoDesbloqueio).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("assinatura inválida é rejeitada (401) e não altera a reserva", async () => {
    const id = await novaReserva();

    const res = await confirmarPagamentoWebhook(id, {
      assinatura: "deadbeef",
    });
    expect(res.status).toBe(401);

    const reserva = await prisma.reserva.findUnique({ where: { id } });
    expect(reserva!.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    expect(reserva!.codigoDesbloqueio).toBeNull();
  });

  it("sem header de assinatura é rejeitado (401)", async () => {
    const id = await novaReserva();
    const corpo = JSON.stringify({ idReserva: id, evento: "pagamento.sucesso" });

    const res = await request(app)
      .post("/api/webhooks/pagamento/stripe")
      .set("Content-Type", "application/json")
      .send(corpo);

    expect(res.status).toBe(401);
  });

  it("provider desconhecido retorna 404", async () => {
    const id = await novaReserva();
    const corpo = JSON.stringify({ idReserva: id, evento: "pagamento.sucesso" });

    const res = await request(app)
      .post("/api/webhooks/pagamento/paypal")
      .set("x-signature", assinarWebhook("stripe", corpo))
      .set("Content-Type", "application/json")
      .send(corpo);

    expect(res.status).toBe(404);
  });

  it("aceita os três gateways (mercadopago, stripe, asaas)", async () => {
    for (const provider of ["mercadopago", "stripe", "asaas"]) {
      const id = await novaReserva();
      const res = await confirmarPagamentoWebhook(id, { provider });
      expect(res.status).toBe(200);
      const reserva = await prisma.reserva.findUnique({ where: { id } });
      expect(reserva!.statusPagamento).toBe("SUCESSO");
    }
  });

  it("evento de falha marca pagamento como FALHA sem gerar código", async () => {
    const id = await novaReserva();

    const res = await confirmarPagamentoWebhook(id, {
      evento: "pagamento.falha",
    });
    expect(res.status).toBe(200);

    const reserva = await prisma.reserva.findUnique({ where: { id } });
    expect(reserva!.statusPagamento).toBe("FALHA");
    expect(reserva!.codigoDesbloqueio).toBeNull();
  });
});

describe("Webhook de pagamento bloqueado — trilha sandbox", () => {
  it("deduplica o mesmo evento do provedor mesmo quando a serialização assinada muda", async () => {
    const admin = await createAccount("ADMIN");
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(200, 2),
    );
    await createBloqueio(admin.token, locatario.locatarioId);

    const providerEventId = "evt-semanticamente-igual";
    const primeiro = JSON.stringify({
      idReserva: reserva.id,
      evento: "pagamento.sucesso",
      metodo: "PIX",
      providerEventId,
    });
    const replayComOutraSerializacao = ` {\n  "providerEventId": "${providerEventId}",\n  "metodo": "PIX",\n  "evento": "pagamento.sucesso",\n  "idReserva": "${reserva.id}"\n}`;

    for (const corpo of [primeiro, replayComOutraSerializacao]) {
      const resposta = await request(app)
        .post("/api/webhooks/pagamento/stripe")
        .set("stripe-signature", assinarWebhook("stripe", corpo))
        .set("Content-Type", "application/json")
        .send(corpo);
      expect(resposta.status).toBe(200);
    }

    expect(
      await prisma.eventoFinanceiroSandbox.count({ where: { idReserva: reserva.id } }),
    ).toBe(3);
  });

  it("replay concorrente reserva o estorno antes de chamar o gateway uma única vez", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(210, 2),
    );
    const chamadas: Array<{ chaveIdempotencia?: string }> = [];
    const audit = new SandboxPaymentAudit({
      solicitarEstorno: async ({ chaveIdempotencia }: { chaveIdempotencia?: string }) => {
        chamadas.push({ chaveIdempotencia });
        await new Promise((resolve) => setTimeout(resolve, 25));
      },
    });

    await Promise.all([
      audit.registrarPagamentoBloqueado(reserva.id, "stripe", "evt-concorrente"),
      audit.registrarPagamentoBloqueado(reserva.id, "stripe", "evt-concorrente"),
    ]);

    expect(chamadas).toEqual([{ chaveIdempotencia: "stripe:evt-concorrente:refund" }]);
    expect(
      await prisma.eventoFinanceiroSandbox.count({ where: { idReserva: reserva.id } }),
    ).toBe(3);
  });

  it("registra recebimento e estorno simulado uma vez sem confirmar ou liberar a reserva", async () => {
    const admin = await createAccount("ADMIN");
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(220, 2),
    );
    await createBloqueio(admin.token, locatario.locatarioId);

    const primeiro = await confirmarPagamentoWebhook(reserva.id, { metodo: "PIX" });
    const repetido = await confirmarPagamentoWebhook(reserva.id, { metodo: "PIX" });

    expect(primeiro.status).toBe(200);
    expect(repetido.status).toBe(200);

    const persistida = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(persistida.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(persistida.statusPagamento).not.toBe("SUCESSO");
    expect(persistida.codigoDesbloqueio).toBeNull();

    const trilha = await prisma.$queryRawUnsafe<Array<{ tipo: string }>>(
      'SELECT "tipo" FROM "EventoFinanceiroSandbox" WHERE "idReserva" = $1 ORDER BY "criadoEm"',
      reserva.id,
    );
    expect(trilha.map((evento) => evento.tipo)).toEqual([
      "PAGAMENTO_RECEBIDO",
      "ESTORNO_SOLICITADO",
      "ESTORNO_CONCLUIDO",
    ]);
  });

  it("falha uma vez e conclui o estorno sandbox em retry automático sem duplicar a trilha", async () => {
    const anterior = process.env.PAGAMENTO_SANDBOX_ESTORNO_FALHA_UNICA;
    process.env.PAGAMENTO_SANDBOX_ESTORNO_FALHA_UNICA = "true";

    try {
      const admin = await createAccount("ADMIN");
      const locador = await createLocador();
      const locatario = await createLocatario();
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const reserva = await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
        futurePeriod(240, 2),
      );
      await createBloqueio(admin.token, locatario.locatarioId);

      expect((await confirmarPagamentoWebhook(reserva.id, { metodo: "PIX" })).status).toBe(200);
      expect((await confirmarPagamentoWebhook(reserva.id, { metodo: "PIX" })).status).toBe(200);

      const trilha = await prisma.$queryRawUnsafe<Array<{ tipo: string }>>(
        'SELECT "tipo" FROM "EventoFinanceiroSandbox" WHERE "idReserva" = $1 ORDER BY "criadoEm", "id"',
        reserva.id,
      );
      expect(trilha.map((evento) => evento.tipo).sort()).toEqual([
        "ESTORNO_CONCLUIDO",
        "ESTORNO_FALHOU",
        "ESTORNO_SOLICITADO",
        "PAGAMENTO_RECEBIDO",
      ]);

      const persistida = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
      expect(persistida.statusPagamento).not.toBe("SUCESSO");
      expect(persistida.codigoDesbloqueio).toBeNull();
    } finally {
      if (anterior === undefined) delete process.env.PAGAMENTO_SANDBOX_ESTORNO_FALHA_UNICA;
      else process.env.PAGAMENTO_SANDBOX_ESTORNO_FALHA_UNICA = anterior;
    }
  });
});
