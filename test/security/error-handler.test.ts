import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import { errorHandler } from "../../src/middlewares/error-handler";
import { HttpError } from "../../src/errors/HttpError";
import { logger } from "../../src/shared/logger";

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.setHeader = (name: string, value: string) => {
    res.headers ??= {};
    res.headers[name] = value;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

const noop = () => {};

describe("errorHandler", () => {
  it("preserva código, status e mensagem de HttpError no envelope", () => {
    const res = mockRes();
    errorHandler(
      new HttpError(404, "Conta n\u00e3o encontrada", "ACCOUNT_NOT_FOUND"),
      { id: "request-business-1" } as any,
      res,
      noop,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      code: "ACCOUNT_NOT_FOUND",
      message: "Conta n\u00e3o encontrada",
      requestId: "request-business-1",
    });
  });

  it("atribui código estável a HttpError sem código de domínio", () => {
    const res = mockRes();
    errorHandler(
      new HttpError(409, "Opera\u00e7\u00e3o n\u00e3o permitida"),
      { id: "request-business-2" } as any,
      res,
      noop,
    );

    expect(res.body).toEqual({
      code: "BUSINESS_ERROR",
      message: "Opera\u00e7\u00e3o n\u00e3o permitida",
      requestId: "request-business-2",
    });
  });

  it("retorna erros de validação sem incluir os valores enviados", () => {
    const res = mockRes();
    const zodErr = z.object({ token: z.string().min(20) }).safeParse({
      token: "segredo-do-token",
    });
    errorHandler(zodErr.error as any, { id: "request-validation-1" } as any, res, noop);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid Data Format");
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.requestId).toBe("request-validation-1");
    expect(res.body.errors).toEqual([
      expect.objectContaining({ path: ["token"], message: expect.any(String) }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain("segredo-do-token");
  });

  it("não vaza mensagem ou stack interna e registra erro com o mesmo requestId", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(noop);
    const res = mockRes();
    const segredo = "Authorization: Bearer segredo-super-sensivel";

    errorHandler(new Error(segredo), { id: "request-internal-1" } as any, res, noop);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal Server Error",
      requestId: "request-internal-1",
    });
    expect(JSON.stringify(res.body)).not.toContain(segredo);
    expect(spy).toHaveBeenCalledWith("unhandled request error", {
      requestId: "request-internal-1",
      errorType: "Error",
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(segredo);
    spy.mockRestore();
  });

  it("trata valores lançados que não são Error como 500 genérico", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(noop);
    const res = mockRes();

    errorHandler("boom" as any, { id: "request-internal-2" } as any, res, noop);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal Server Error",
      requestId: "request-internal-2",
    });
    spy.mockRestore();
  });
});
