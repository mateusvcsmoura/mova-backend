import request from "supertest";
import { describe, it, expect, beforeAll, vi } from "vitest";

import { app } from "../../src/app";
import { NotificacaoReservaService } from "../../src/services/notificacao-reserva";
import { createLocatario, type LocatarioContext } from "../helpers";

describe("Preferências de notificação (opt-in/opt-out)", () => {
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locatario = await createLocatario();
  });

  it("começa sem preferências (opt-in por padrão)", async () => {
    const res = await request(app)
      .get("/api/notificacao/preferencias")
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual([]);
  });

  it("registra opt-out e depois volta ao opt-in (canal x tipo)", async () => {
    const optOut = await request(app)
      .put("/api/notificacao/preferencias")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ canal: "EMAIL", tipo: "RESERVA", habilitado: false });

    expect(optOut.status).toBe(200);
    expect(optOut.body.result.habilitado).toBe(false);

    const lista = await request(app)
      .get("/api/notificacao/preferencias")
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(lista.body.result).toHaveLength(1);
    expect(lista.body.result[0]).toMatchObject({
      canal: "EMAIL",
      tipo: "RESERVA",
      habilitado: false,
    });

    // Idempotente por (canal,tipo): re-habilitar atualiza a mesma linha.
    const optIn = await request(app)
      .put("/api/notificacao/preferencias")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ canal: "EMAIL", tipo: "RESERVA", habilitado: true });
    expect(optIn.body.result.habilitado).toBe(true);

    const lista2 = await request(app)
      .get("/api/notificacao/preferencias")
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(lista2.body.result).toHaveLength(1);
  });

  it("recusa payload inválido", async () => {
    const res = await request(app)
      .put("/api/notificacao/preferencias")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ canal: "TELEGRAM", tipo: "RESERVA", habilitado: false });
    expect(res.status).toBe(400);
  });
});

// Gating do notificador: respeita o opt-out antes de enviar (unit, sem DB).
describe("NotificacaoReservaService — respeita opt-out", () => {
  function build(habilitada: boolean) {
    const send = vi.fn(async () => ({ messageId: "x" }));
    const mailProvider = { isEnabled: () => true, send } as any;
    const reportService = {
      buildReport: async () => ({
        payload: { locatario: { email: "a@b.local" } },
        content: { subject: "s", html: "h", text: "t" },
      }),
    } as any;
    const notificacaoRepository = {
      registrar: vi.fn(async () => ({ id: "r1" })),
      marcarEnviada: vi.fn(async () => ({})),
      marcarFalha: vi.fn(async () => ({})),
    } as any;
    const checker = { estaHabilitada: vi.fn(async () => habilitada) } as any;
    const service = new NotificacaoReservaService(
      reportService,
      mailProvider,
      notificacaoRepository,
      checker,
    );
    return { service, send };
  }

  const reserva = {
    id: "res-1",
    idLocatario: "loc-1",
    statusPagamento: "SUCESSO",
  } as any;

  it("NÃO envia quando o locatário optou por não receber", async () => {
    const { service, send } = build(false);
    await service.notificarReservaConfirmada(reserva);
    expect(send).not.toHaveBeenCalled();
  });

  it("envia quando habilitado (opt-in)", async () => {
    const { service, send } = build(true);
    await service.notificarReservaConfirmada(reserva);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
