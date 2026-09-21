import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  DEFAULT_SENHA,
  createAccount,
  createAdminAccount,
  uniqueEmail,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function registrationPayload(cargo: unknown, email = uniqueEmail("cargo")) {
  return {
    nome: "Conta Segura",
    email,
    senha: DEFAULT_SENHA,
    cep: "12345-678",
    endereco: "Rua Segura, 123",
    cargo,
  };
}

describe("segurança de cargo", () => {
  it.each(["ADMIN", "ROOT", "SUPERADMIN", "", null])(
    "rejeita cargo público %j sem criar conta ou token",
    async (cargo) => {
      const email = uniqueEmail("registro-proibido");

      const response = await request(app)
        .post("/api/conta/auth/register")
        .send(registrationPayload(cargo, email));

      expect(response.status).toBe(400);
      expect(response.body.result?.token).toBeUndefined();
      expect(await prisma.conta.findUnique({ where: { email } })).toBeNull();
    },
  );

  it.each(["LOCATARIO", "LOCADOR"] as const)(
    "mantém cadastro público legítimo de %s",
    async (cargo) => {
      const response = await request(app)
        .post("/api/conta/auth/register")
        .send(registrationPayload(cargo));

      expect(response.status).toBe(201);
      expect(response.body.result.conta.cargo).toBe(cargo);
      expect(response.body.result.token).toEqual(expect.any(String));
    },
  );

  it("exige cargo no cadastro público", async () => {
    const { cargo: _cargo, ...payload } = registrationPayload("LOCATARIO");

    const response = await request(app)
      .post("/api/conta/auth/register")
      .send(payload);

    expect(response.status).toBe(400);
  });

  it("mantém criação administrativa de ADMIN protegida", async () => {
    const admin = await createAdminAccount();
    const locatario = await createAccount("LOCATARIO");
    const locador = await createAccount("LOCADOR");
    const payload = registrationPayload("ADMIN", uniqueEmail("admin-legitimo"));

    const anonymous = await request(app)
      .post("/api/admin/conta/create")
      .send(payload);
    const deniedLocatario = await request(app)
      .post("/api/admin/conta/create")
      .set(auth(locatario.token))
      .send(payload);
    const deniedLocador = await request(app)
      .post("/api/admin/conta/create")
      .set(auth(locador.token))
      .send(payload);
    const created = await request(app)
      .post("/api/admin/conta/create")
      .set(auth(admin.token))
      .send(payload);

    expect(anonymous.status).toBe(401);
    expect(deniedLocatario.status).toBe(403);
    expect(deniedLocador.status).toBe(403);
    expect(created.status).toBe(201);
    expect(created.body.result.cargo).toBe("ADMIN");
  });

  it.each(["ADMIN", "LOCADOR"] as const)(
    "rejeita alteração de cargo do LOCATARIO para %s integralmente",
    async (cargo) => {
      const locatario = await createAccount("LOCATARIO");
      const nomeOriginal = locatario.conta.nome;

      const response = await request(app)
        .put("/api/conta/auth/update-profile")
        .set(auth(locatario.token))
        .send({ nome: "Nome Não Aplicado", cargo });

      expect(response.status).toBe(400);
      const persisted = await prisma.conta.findUniqueOrThrow({
        where: { id: locatario.conta.id },
      });
      expect(persisted.cargo).toBe("LOCATARIO");
      expect(persisted.nome).toBe(nomeOriginal);

      const login = await request(app)
        .post("/api/conta/auth/login")
        .send({ email: locatario.email, senha: DEFAULT_SENHA });
      const adminRoute = await request(app)
        .get("/api/admin/conta/all")
        .set(auth(login.body.result.token));

      expect(login.status).toBe(200);
      expect(adminRoute.status).toBe(403);
    },
  );

  it("rejeita alteração de cargo do LOCADOR e mantém campos legítimos editáveis", async () => {
    const locador = await createAccount("LOCADOR");

    const denied = await request(app)
      .put("/api/conta/auth/update-profile")
      .set(auth(locador.token))
      .send({ cargo: "ADMIN" });
    const updated = await request(app)
      .put("/api/conta/auth/update-profile")
      .set(auth(locador.token))
      .send({
        nome: "Locador Atualizado",
        telefone: "11999999999",
        endereco: "Avenida Atualizada, 10",
        cep: "98765-432",
      });

    expect(denied.status).toBe(400);
    expect(updated.status).toBe(200);
    expect(updated.body.result.conta).toMatchObject({
      cargo: "LOCADOR",
      nome: "Locador Atualizado",
      telefone: "11999999999",
      endereco: "Avenida Atualizada, 10",
      cep: "98765-432",
    });
  });

  it("rejeita outros campos administrativos no update próprio", async () => {
    const locatario = await createAccount("LOCATARIO");

    const response = await request(app)
      .put("/api/conta/auth/update-profile")
      .set(auth(locatario.token))
      .send({
        id: "00000000-0000-0000-0000-000000000000",
        idLocatario: "00000000-0000-0000-0000-000000000000",
        senhaHash: "não-alterar",
        criadaEm: "2020-01-01T00:00:00.000Z",
      });

    expect(response.status).toBe(400);
    const persisted = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.conta.id },
    });
    expect(persisted.cargo).toBe("LOCATARIO");
  });
});
