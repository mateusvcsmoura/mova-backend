import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";

import { app } from "../../src/app";
import { observability } from "../../src/middlewares/observability";

describe("Observabilidade", () => {
  it("adiciona o header X-Request-Id na resposta", async () => {
    const res = await request(app).get("/health");

    expect(res.headers).toHaveProperty("x-request-id");
    expect(res.headers["x-request-id"]).toMatch(/[0-9a-f-]{36}/i);
  });

  it("reutiliza o X-Request-Id recebido para correlação", async () => {
    const enviado = "req-de-teste-123";
    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", enviado);

    expect(res.headers["x-request-id"]).toBe(enviado);
  });

  it("expõe req.id às rotas seguintes", async () => {
    const probe = express();
    probe.use(observability);
    probe.get("/probe", (req, res) => {
      res.json({ id: req.id });
    });

    const res = await request(probe).get("/probe");

    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);
    expect(res.body.id).toBe(res.headers["x-request-id"]);
  });
});
