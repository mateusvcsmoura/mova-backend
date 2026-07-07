import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import { errorHandler } from "../../src/middlewares/error-handler";
import { HttpError } from "../../src/errors/HttpError";

// Duble mínimo de Response que captura status e corpo JSON.
function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
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
  it("preserva status e mensagem de HttpError", () => {
    const res = mockRes();
    errorHandler(new HttpError(404, "Conta não encontrada"), {} as any, res, noop);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: "Conta não encontrada" });
  });

  it("retorna 400 com issues para ZodError", () => {
    const res = mockRes();
    const zodErr = z.string().safeParse(123);
    errorHandler(zodErr.error as any, {} as any, res, noop);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid Data Format");
    expect(res.body).toHaveProperty("errors");
  });

  it("NÃO vaza a mensagem interna em erros 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(noop);
    const res = mockRes();
    const segredo = "connect ECONNREFUSED 10.0.0.5:5432 senha=super-secreta";

    errorHandler(new Error(segredo), {} as any, res, noop);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Internal Server Error" });
    expect(JSON.stringify(res.body)).not.toContain(segredo);
    // Detalhes devem ir apenas para o log interno.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("trata erros não-Error (throw de string/objeto) como 500 genérico", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(noop);
    const res = mockRes();

    errorHandler("boom" as any, {} as any, res, noop);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Internal Server Error" });
    spy.mockRestore();
  });
});
