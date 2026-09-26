import express, { RequestHandler } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Cargo } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { env } from "../../src/config/env";
import { authMiddleware } from "../../src/middlewares/auth-middleware";
import { authorize, authorizeOwner } from "../../src/middlewares/authorization-middleware";
import { errorHandler } from "../../src/middlewares/error-handler";
import { observability } from "../../src/middlewares/observability";

const REQUEST_ID = "auth-envelope-request";

function createProbe(middleware: RequestHandler[], route = "/probe") {
  const app = express();
  app.use(observability);
  app.get(route, ...middleware, (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  return app;
}

async function expectEnvelope(
  response: request.Response,
  status: number,
  code: string,
  message: string,
) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ code, message, requestId: REQUEST_ID });
  expect(response.headers["x-request-id"]).toBe(REQUEST_ID);
}

describe("envelope de autenticação e autorização", () => {
  it("correlaciona a recusa por ausência de token", async () => {
    const response = await request(createProbe([authMiddleware]))
      .get("/probe")
      .set("X-Request-Id", REQUEST_ID);

    await expectEnvelope(response, 401, "UNAUTHENTICATED", "Não autenticado");
  });

  it.each([
    ["token com assinatura inválida", "Bearer token-invalido"],
    [
      "token expirado",
      `Bearer ${jwt.sign({ id: "user-1", cargo: Cargo.LOCATARIO }, env.JWT_SECRET, { expiresIn: -1 })}`,
    ],
    [
      "token sem cargo",
      `Bearer ${jwt.sign({ id: "user-1" }, env.JWT_SECRET)}`,
    ],
  ])("inclui código e requestId para %s", async (_case, authorization) => {
    const response = await request(createProbe([authMiddleware]))
      .get("/probe")
      .set("X-Request-Id", REQUEST_ID)
      .set("Authorization", authorization);

    await expectEnvelope(response, 401, "INVALID_TOKEN", "Token inválido");
  });

  it("correlaciona a ausência de usuário autenticado na autorização por cargo", async () => {
    const response = await request(createProbe([authorize(Cargo.ADMIN)]))
      .get("/probe")
      .set("X-Request-Id", REQUEST_ID);

    await expectEnvelope(response, 401, "UNAUTHENTICATED", "Não autenticado");
  });

  it("correlaciona a recusa por cargo insuficiente", async () => {
    const authenticated: RequestHandler = (req, _res, next) => {
      req.user = { id: "user-1", cargo: Cargo.LOCATARIO };
      next();
    };
    const response = await request(
      createProbe([authenticated, authorize(Cargo.ADMIN)]),
    )
      .get("/probe")
      .set("X-Request-Id", REQUEST_ID);

    await expectEnvelope(response, 403, "FORBIDDEN", "Acesso negado");
  });

  it("correlaciona a recusa de propriedade do recurso", async () => {
    const authenticated: RequestHandler = (req, _res, next) => {
      req.user = { id: "user-1", cargo: Cargo.LOCATARIO };
      next();
    };
    const response = await request(
      createProbe([authenticated, authorizeOwner()], "/probe/:id"),
    )
      .get("/probe/other-user")
      .set("X-Request-Id", REQUEST_ID);

    await expectEnvelope(response, 403, "FORBIDDEN", "Acesso negado");
  });

  it("correlaciona a ausência de usuário autenticado na autorização de propriedade", async () => {
    const response = await request(createProbe([authorizeOwner()]))
      .get("/probe")
      .set("X-Request-Id", REQUEST_ID);

    await expectEnvelope(response, 401, "UNAUTHENTICATED", "Não autenticado");
  });

  it("retorna envelope de validação quando falta o parâmetro de propriedade", async () => {
    const authenticated: RequestHandler = (req, _res, next) => {
      req.user = { id: "user-1", cargo: Cargo.LOCATARIO };
      next();
    };
    const response = await request(
      createProbe([authenticated, authorizeOwner()]),
    )
      .get("/probe")
      .set("X-Request-Id", REQUEST_ID);

    await expectEnvelope(
      response,
      400,
      "VALIDATION_ERROR",
      "Parâmetro 'id' não encontrado na rota",
    );
  });
});
