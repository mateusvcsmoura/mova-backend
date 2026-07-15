import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";

import { app } from "../../src/app";
import { createHealthRouter } from "../../src/routes/health/health";
import { observability } from "../../src/middlewares/observability";

describe("Health & readiness", () => {
  describe("GET /api/health", () => {
    it("retorna 200 com status, uptime e timestamp", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof res.body.timestamp).toBe("string");
      expect(new Date(res.body.timestamp).toString()).not.toBe("Invalid Date");
    });
  });

  describe("GET /api/ready", () => {
    it("retorna 200 quando o banco responde", async () => {
      const res = await request(app).get("/api/ready");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ready");
      expect(res.body.database).toBe("up");
    });

    it("retorna 503 quando o banco está indisponível", async () => {
      // App descartável com um ping que falha, simulando banco fora do ar.
      const brokenApp = express();
      brokenApp.use(observability);
      brokenApp.use(
        createHealthRouter(async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
        }),
      );

      const res = await request(brokenApp).get("/ready");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("unavailable");
      expect(res.body.database).toBe("down");
    });

    it("não vaza o detalhe do erro de banco na resposta", async () => {
      const brokenApp = express();
      brokenApp.use(observability);
      const segredo = "connect ECONNREFUSED 10.0.0.5:5432 senha=xyz";
      brokenApp.use(
        createHealthRouter(async () => {
          throw new Error(segredo);
        }),
      );

      const res = await request(brokenApp).get("/ready");

      expect(JSON.stringify(res.body)).not.toContain(segredo);
    });
  });
});
