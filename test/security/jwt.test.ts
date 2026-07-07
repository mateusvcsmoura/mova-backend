import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect } from "vitest";

import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { createAccount } from "../helpers";

// Garante que o authMiddleware verifica o token contra env.JWT_SECRET (segredo
// validado no boot) — e não contra um process.env não validado.
describe("Autenticação JWT", () => {
  it("aceita token assinado com env.JWT_SECRET (id + cargo)", async () => {
    const { conta } = await createAccount("LOCATARIO");

    const token = jwt.sign(
      { id: conta.id, cargo: "LOCATARIO" },
      env.JWT_SECRET as jwt.Secret,
      { expiresIn: "1h" },
    );

    const res = await request(app)
      .get("/api/conta/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it("rejeita token assinado com segredo diferente (401)", async () => {
    const { conta } = await createAccount("LOCATARIO");

    const token = jwt.sign(
      { id: conta.id, cargo: "LOCATARIO" },
      "segredo-errado",
      { expiresIn: "1h" },
    );

    const res = await request(app)
      .get("/api/conta/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("rejeita token sem cargo no payload (401)", async () => {
    const { conta } = await createAccount("LOCATARIO");

    const token = jwt.sign({ id: conta.id }, env.JWT_SECRET as jwt.Secret, {
      expiresIn: "1h",
    });

    const res = await request(app)
      .get("/api/conta/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("rejeita requisição sem token (401)", async () => {
    const res = await request(app).get("/api/conta/auth/me");

    expect(res.status).toBe(401);
  });
});
