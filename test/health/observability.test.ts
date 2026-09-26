import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { app } from "../../src/app";
import { observability } from "../../src/middlewares/observability";
import { errorHandler } from "../../src/middlewares/error-handler";
import { logger } from "../../src/shared/logger";

describe("Observabilidade e erros correlacionados", () => {
  it("adiciona X-Request-Id na resposta e disponibiliza req.id", async () => {
    const probe = express();
    probe.use(observability);
    probe.get("/probe", (req, res) => {
      res.json({ id: req.id });
    });

    const res = await request(probe).get("/probe");

    expect(res.headers).toHaveProperty("x-request-id");
    expect(res.headers["x-request-id"]).toMatch(/[0-9a-f-]{36}/i);
    expect(res.body.id).toBe(res.headers["x-request-id"]);
  });

  it("retorna 404 de API como erro de operação e correlaciona o log", async () => {
    const logInfo = vi.spyOn(logger, "info").mockImplementation(() => {});
    const requestId = "task-7-404-request";

    try {
      const res = await request(app)
        .get("/api/route-absent")
        .set("X-Request-Id", requestId);

      expect(res.status).toBe(404);
      expect(res.body).toEqual(expect.objectContaining({
        code: "NOT_FOUND",
        message: "Rota da API n\u00e3o encontrada.",
        requestId,
      }));
      expect(res.headers["x-request-id"]).toBe(requestId);
      expect(logInfo).toHaveBeenCalledWith(
        "request",
        expect.objectContaining({ requestId, status: 404 }),
      );
      expect(JSON.stringify(logInfo.mock.calls)).not.toContain("route-absent");
    } finally {
      logInfo.mockRestore();
    }
  });

  it("não registra URL com token nem mensagem interna e usa o requestId comum", async () => {
    const logInfo = vi.spyOn(logger, "info").mockImplementation(() => {});
    const logError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const probe = express();
    const requestId = "task-7-sensitive-request";
    const secret = "token-secreto-de-autenticacao";

    probe.use(observability);
    probe.get("/private/:token", (_req, _res, next) => {
      next(new Error(secret));
    });
    probe.use(errorHandler);

    try {
      const res = await request(probe)
        .get(`/private/${secret}`)
        .set("X-Request-Id", requestId);

      expect(res.status).toBe(500);
      expect(res.body.requestId).toBe(requestId);
      expect(res.headers["x-request-id"]).toBe(requestId);
      expect(logError).toHaveBeenCalledWith("unhandled request error", {
        requestId,
        errorType: "Error",
      });
      expect(logInfo).toHaveBeenCalledWith(
        "request",
        expect.objectContaining({ requestId, status: 500 }),
      );
      expect(JSON.stringify([logInfo.mock.calls, logError.mock.calls])).not.toContain(secret);
    } finally {
      logInfo.mockRestore();
      logError.mockRestore();
    }
  });
});
