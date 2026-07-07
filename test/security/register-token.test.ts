import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect } from "vitest";

import { app } from "../../src/app";
import {
  DEFAULT_SENHA,
  uniqueEmail,
} from "../helpers";

// O token emitido no cadastro deve ter o MESMO payload do login (id + cargo),
// para que o authMiddleware — que exige cargo — o aceite.
describe("Token do register", () => {
  async function registrar(cargo: string) {
    return request(app)
      .post("/api/conta/auth/register")
      .send({
        nome: `Reg ${cargo}`,
        email: uniqueEmail("reg"),
        senha: DEFAULT_SENHA,
        cep: "12345-678",
        endereco: "Rua do Registro, 1",
        cargo,
      });
  }

  it("inclui id e cargo no payload do token", async () => {
    const res = await registrar("LOCADOR");

    expect(res.status).toBe(201);
    const { conta, token } = res.body.result;

    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    expect(decoded).toBeTruthy();
    expect(decoded).toHaveProperty("id", conta.id);
    expect(decoded).toHaveProperty("cargo", "LOCADOR");
  });

  it("o token do register é aceito em rota protegida", async () => {
    const res = await registrar("LOCATARIO");
    const { token } = res.body.result;

    const me = await request(app)
      .get("/api/conta/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
  });
});
