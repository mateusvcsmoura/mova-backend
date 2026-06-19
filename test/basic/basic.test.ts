import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect } from "vitest";

describe("Basic API", () => {
  describe("GET /api/basic/status", () => {
    it("deve retornar status online", async () => {
      const response = await request(app).get("/api/basic/status");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("API online");
    });
  });
});
