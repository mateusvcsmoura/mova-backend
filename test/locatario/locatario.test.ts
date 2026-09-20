import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  Account,
  createAccount,
  uniqueCpf,
  uniqueCnh,
  uniqueRg,
  DEFAULT_DATA_NASCIMENTO,
} from "../helpers";

type LocatarioFixture = {
  account: Account;
  id: string;
  cpf: string;
  cnh: string;
  rg: string;
};

async function createProfile(account: Account): Promise<LocatarioFixture> {
  const cpf = uniqueCpf();
  const cnh = uniqueCnh();
  const rg = uniqueRg();
  const response = await request(app)
    .post("/api/locatario")
    .set("Authorization", `Bearer ${account.token}`)
    .send({ cpf, cnh, rg, dataNascimento: DEFAULT_DATA_NASCIMENTO });

  expect(response.status).toBe(201);
  return { account, id: response.body.result.id, cpf, cnh, rg };
}

describe("Locatario API", () => {
  let titular: LocatarioFixture;
  let outro: LocatarioFixture;
  let admin: Account;
  let locador: Account;

  beforeAll(async () => {
    titular = await createProfile(await createAccount("LOCATARIO"));
    outro = await createProfile(await createAccount("LOCATARIO"));
    admin = await createAccount("ADMIN");
    locador = await createAccount("LOCADOR");
  });

  describe("POST /api/locatario", () => {
    it("recusa criação sem token", async () => {
      const response = await request(app).post("/api/locatario").send({
        cpf: uniqueCpf(),
        cnh: uniqueCnh(),
        rg: uniqueRg(),
        dataNascimento: DEFAULT_DATA_NASCIMENTO,
      });

      expect(response.status).toBe(401);
    });

    it("vincula o perfil ao titular do JWT e ignora ID alheio no payload", async () => {
      const account = await createAccount("LOCATARIO");
      const response = await request(app)
        .post("/api/locatario")
        .set("Authorization", `Bearer ${account.token}`)
        .send({
          id: outro.id,
          idConta: outro.id,
          cargo: "ADMIN",
          propriedade: outro.id,
          cpf: uniqueCpf(),
          cnh: uniqueCnh(),
          rg: uniqueRg(),
          dataNascimento: DEFAULT_DATA_NASCIMENTO,
        });

      expect(response.status).toBe(201);
      expect(response.body.result.id).toBe(account.conta.id);
      expect(response.body.result.id).not.toBe(outro.id);
    });
  });

  describe("leitura privada", () => {
    it("recusa leitura sem token", async () => {
      const response = await request(app).get(`/api/locatario/${titular.id}`);
      expect(response.status).toBe(401);
    });

    it("recusa token inválido", async () => {
      const response = await request(app)
        .get(`/api/locatario/${titular.id}`)
        .set("Authorization", "Bearer token-invalido");
      expect(response.status).toBe(401);
    });

    it("permite ao titular ler somente seu perfil", async () => {
      const response = await request(app)
        .get(`/api/locatario/${titular.id}`)
        .set("Authorization", `Bearer ${titular.account.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result).toMatchObject({ id: titular.id, cpf: titular.cpf });
    });

    it("bloqueia leitura de perfil alheio", async () => {
      const response = await request(app)
        .get(`/api/locatario/${outro.id}`)
        .set("Authorization", `Bearer ${titular.account.token}`);
      expect(response.status).toBe(403);
    });

    it("bloqueia cargo LOCADOR", async () => {
      const response = await request(app)
        .get(`/api/locatario/${titular.id}`)
        .set("Authorization", `Bearer ${locador.token}`);
      expect(response.status).toBe(403);
    });

    it("lista somente perfil do titular e não documentos de terceiros", async () => {
      const response = await request(app)
        .get("/api/locatario/all")
        .set("Authorization", `Bearer ${titular.account.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result).toHaveLength(1);
      expect(response.body.result[0].id).toBe(titular.id);
      expect(response.body.result.map((profile: { cpf: string }) => profile.cpf)).not.toContain(outro.cpf);
    });

    it("não usa CPF de terceiro para busca de usuário comum", async () => {
      const response = await request(app)
        .get("/api/locatario/search")
        .query({ cpf: outro.cpf })
        .set("Authorization", `Bearer ${titular.account.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(titular.id);
      expect(response.body.result.cpf).toBe(titular.cpf);
    });
  });

  describe("mutação privada", () => {
    it("bloqueia edição de perfil alheio", async () => {
      const response = await request(app)
        .put(`/api/locatario/${outro.id}`)
        .set("Authorization", `Bearer ${titular.account.token}`)
        .send({ cnh: uniqueCnh() });
      expect(response.status).toBe(403);
    });

    it("bloqueia exclusão de perfil alheio", async () => {
      const response = await request(app)
        .delete(`/api/locatario/${outro.id}`)
        .set("Authorization", `Bearer ${titular.account.token}`);
      expect(response.status).toBe(403);
    });

    it("permite ao titular editar seu perfil", async () => {
      const cnh = uniqueCnh();
      const response = await request(app)
        .put(`/api/locatario/${titular.id}`)
        .set("Authorization", `Bearer ${titular.account.token}`)
        .send({ cnh, id: outro.id, idConta: outro.id, cargo: "ADMIN" });

      expect(response.status).toBe(200);
      expect(response.body.result).toMatchObject({ id: titular.id, cnh });
    });

    it("preserva acesso administrativo previsto", async () => {
      const cnh = uniqueCnh();
      const read = await request(app)
        .get(`/api/locatario/${outro.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      const update = await request(app)
        .put(`/api/locatario/${outro.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ cnh });
      const list = await request(app)
        .get("/api/locatario/all")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(read.status).toBe(200);
      expect(update.status).toBe(200);
      expect(update.body.result).toMatchObject({ id: outro.id, cnh });
      expect(list.status).toBe(200);
      expect(list.body.result.map((profile: { id: string }) => profile.id)).toEqual(
        expect.arrayContaining([titular.id, outro.id]),
      );
    });

    it("permite ao titular excluir seu perfil", async () => {
      const account = await createAccount("LOCATARIO");
      const profile = await createProfile(account);
      const response = await request(app)
        .delete(`/api/locatario/${profile.id}`)
        .set("Authorization", `Bearer ${account.token}`);

      expect(response.status).toBe(204);
    });
  });
});
