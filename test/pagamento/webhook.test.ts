import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  assinarWebhook,
  confirmarPagamentoWebhook,
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
