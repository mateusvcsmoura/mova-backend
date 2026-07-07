import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";

import { createRateLimiter } from "../../src/middlewares/rate-limit";

// O rate limiter é desativado no ambiente de teste (skipInTest) para não
// estrangular a suíte. Aqui construímos um limitador com skipInTest = false
// e limite baixo, montado num app descartável, para exercitar o retorno 429.
describe("Rate limiting", () => {
  function makeApp(limit: number) {
    const app = express();
    const limiter = createRateLimiter({
      skipInTest: false,
      windowMs: 60_000,
      limit,
    });
    app.get("/ping", limiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    return app;
  }

  it("libera requisições dentro do limite", async () => {
    const app = makeApp(2);

    const r1 = await request(app).get("/ping");
    const r2 = await request(app).get("/ping");

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it("bloqueia com 429 ao ultrapassar o limite", async () => {
    const app = makeApp(2);

    await request(app).get("/ping");
    await request(app).get("/ping");
    const bloqueada = await request(app).get("/ping");

    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.message).toMatch(/muitas requisições/i);
  });

  it("expõe os headers padrão de rate limit (draft-7)", async () => {
    const app = makeApp(5);

    const res = await request(app).get("/ping");

    expect(res.headers).toHaveProperty("ratelimit");
  });
});
