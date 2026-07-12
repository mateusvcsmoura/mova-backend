import { describe, it, expect, vi } from "vitest";

import { resolveLocale, traduzirErro, ErrorCode } from "../../src/i18n/index";
import { errorHandler } from "../../src/middlewares/error-handler";
import { HttpError } from "../../src/errors/HttpError";
import { renderReservaReport } from "../../src/templates/reserva-report.template";
import type { ReservaReportPayload } from "../../src/services/contracts/reserva-report";
import { z } from "zod";

// Simula res do Express capturando status/json.
function fakeRes() {
  const captured: { status?: number; body?: any } = {};
  const res: any = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: any) {
      captured.body = body;
      return res;
    },
  };
  return { res, captured };
}

describe("i18n — resolução de idioma", () => {
  it("resolve pt/en/es do Accept-Language e cai no padrão pt", () => {
    expect(resolveLocale("en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale("es-ES")).toBe("es");
    expect(resolveLocale("pt-BR,pt;q=0.9")).toBe("pt");
    expect(resolveLocale("fr-FR")).toBe("pt"); // desconhecido -> padrão
    expect(resolveLocale(undefined)).toBe("pt");
  });

  it("traduz códigos de erro estáveis por idioma", () => {
    expect(traduzirErro(ErrorCode.FORBIDDEN, "en")).toBe("Access denied.");
    expect(traduzirErro(ErrorCode.FORBIDDEN, "es")).toBe("Acceso denegado.");
    expect(traduzirErro("CODIGO_INEXISTENTE", "en")).toBeUndefined();
  });
});

describe("i18n — error-handler", () => {
  const next = vi.fn();

  it("pt (padrão) mantém a mensagem original do HttpError", () => {
    const { res, captured } = fakeRes();
    errorHandler(
      new HttpError(403, "Acesso negado", ErrorCode.FORBIDDEN),
      { locale: "pt" } as any,
      res,
      next,
    );
    expect(captured.status).toBe(403);
    expect(captured.body).toEqual({ code: "FORBIDDEN", message: "Acesso negado" });
  });

  it("en traduz a mensagem pelo código, mantendo o code estável", () => {
    const { res, captured } = fakeRes();
    errorHandler(
      new HttpError(403, "Acesso negado", ErrorCode.FORBIDDEN),
      { locale: "en" } as any,
      res,
      next,
    );
    expect(captured.body.code).toBe("FORBIDDEN");
    expect(captured.body.message).toBe("Access denied.");
  });

  it("HttpError sem código não é traduzido (compatibilidade)", () => {
    const { res, captured } = fakeRes();
    errorHandler(
      new HttpError(404, "Reserva não encontrada"),
      { locale: "en" } as any,
      res,
      next,
    );
    expect(captured.body).toEqual({ message: "Reserva não encontrada" });
  });

  it("ZodError vira VALIDATION_ERROR e traduz em es", () => {
    const { res, captured } = fakeRes();
    const zerr = z.object({ x: z.string() }).safeParse({});
    errorHandler(
      (zerr as any).error,
      { locale: "es" } as any,
      res,
      next,
    );
    expect(captured.status).toBe(400);
    expect(captured.body.code).toBe("VALIDATION_ERROR");
    expect(captured.body.message).toBe("Datos inválidos.");
  });
});

describe("i18n — template de e-mail por idioma", () => {
  const payload: ReservaReportPayload = {
    reserva: {
      id: "abcd1234-0000-0000-0000-000000000000",
      criadaEm: new Date("2026-07-01T09:00:00.000Z"),
      status: "CONFIRMADA",
      statusPagamento: "SUCESSO",
      dataHoraInicio: new Date("2026-08-01T09:00:00.000Z"),
      dataHoraFim: new Date("2026-08-03T09:00:00.000Z"),
      dias: 2,
      valorBase: 200,
      valorServicos: 50,
      valorTotal: 250,
      codigoDesbloqueio: "ABCD-2345",
      metodoPagamento: "PIX",
    },
    veiculo: {
      marca: "Fiat",
      modelo: "Argo",
      ano: 2022,
      placa: "ABC1234",
      categoria: "ECONOMICO",
      cambio: "Manual",
      capacidade: 5,
      eletrico: false,
      adaptado: false,
    },
    locador: { empresa: "Locadora X" },
    locatario: { nome: "Ana", email: "ana@test.local" },
    retirada: null,
    devolucao: null,
    servicos: [],
  };

  it("assunto e rótulos mudam por idioma; padrão é pt", () => {
    expect(renderReservaReport(payload).subject).toContain("Reserva confirmada");
    expect(renderReservaReport(payload, "en").subject).toContain("Booking confirmed");
    expect(renderReservaReport(payload, "es").subject).toContain("Reserva confirmada");

    expect(renderReservaReport(payload, "en").html).toContain("Unlock code");
    expect(renderReservaReport(payload, "es").html).toContain("Código de desbloqueo");
  });
});
