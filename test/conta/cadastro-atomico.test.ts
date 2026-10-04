import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { PrismaContaRepository } from "../../src/repositories/prisma/prisma.conta.repository";
import {
  DEFAULT_DATA_NASCIMENTO,
  DEFAULT_SENHA,
  createLocatario,
  createLocador,
  uniqueCnh,
  uniqueCnpj,
  uniqueCpf,
  uniqueEmail,
  uniqueRg,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Task 10 — M-05 (D10-07/D10-08): Conta + perfil nascem numa única transação.
// Qualquer falha desfaz tudo: nenhuma Conta órfã, nenhum perfil sem Conta.

const registrar = (body: Record<string, unknown>) =>
  request(app).post("/api/conta/auth/register").send(body);

const conta = (cargo: "LOCATARIO" | "LOCADOR", email = uniqueEmail(cargo.toLowerCase())) => ({
  nome: `Pessoa ${cargo}`,
  email,
  senha: DEFAULT_SENHA,
  cep: "80000-000",
  endereco: "Rua Atômica, 10",
  cargo,
});

const perfilLocatario = (overrides: Record<string, unknown> = {}) => ({
  cpf: uniqueCpf(),
  cnh: uniqueCnh(),
  rg: uniqueRg(),
  dataNascimento: DEFAULT_DATA_NASCIMENTO,
  ...overrides,
});

const contasCom = (email: string) => prisma.conta.count({ where: { email } });

function semSegredos(body: unknown) {
  const texto = JSON.stringify(body);
  expect(texto).not.toMatch(/senhaHash|\$2[aby]\$/);
  expect(texto).not.toContain(DEFAULT_SENHA);
}

describe("Task 10 — M-05: cadastro atômico do locatário (RF01)", () => {
  let existente: LocatarioContext;

  beforeAll(async () => {
    existente = await createLocatario();
  });

  it("sucesso cria Conta + Locatário numa operação e devolve resposta sanitizada", async () => {
    const dados = conta("LOCATARIO");
    const perfil = perfilLocatario();
    const res = await registrar({ ...dados, locatario: perfil });

    expect(res.status).toBe(201);
    expect(res.body.result.conta).toMatchObject({ email: dados.email, cargo: "LOCATARIO" });
    expect(res.body.result.locatario).toMatchObject({ cpf: perfil.cpf, cnh: perfil.cnh });
    expect(res.body.result.token).toBeTruthy();
    semSegredos(res.body);

    const salvo = await prisma.conta.findUniqueOrThrow({ where: { email: dados.email }, include: { locatario: true } });
    expect(salvo.locatario?.id).toBe(salvo.id);
    expect(salvo.senhaHash).toMatch(/^\$2[aby]\$10\$/);
    expect(salvo.senhaHash).not.toBe(DEFAULT_SENHA);

    // O token do cadastro já enxerga o perfil completo.
    const me = await request(app).get("/api/conta/auth/me").set("Authorization", `Bearer ${res.body.result.token}`);
    expect(me.body.result.conta.locatario).toMatchObject({ cpf: perfil.cpf });
  });

  it("CPF duplicado: 409 e nenhuma Conta criada", async () => {
    const dados = conta("LOCATARIO");
    const res = await registrar({ ...dados, locatario: perfilLocatario({ cpf: existente.cpf }) });
    expect(res.status).toBe(409);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("CNH duplicada: 409 e nenhuma Conta criada", async () => {
    const dados = conta("LOCATARIO");
    const res = await registrar({ ...dados, locatario: perfilLocatario({ cnh: existente.cnh }) });
    expect(res.status).toBe(409);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("e-mail duplicado: 409 e nenhum Locatário criado", async () => {
    const perfil = perfilLocatario();
    const res = await registrar({ ...conta("LOCATARIO", existente.email), locatario: perfil });
    expect(res.status).toBe(409);
    expect(await prisma.locatario.count({ where: { cpf: perfil.cpf } })).toBe(0);
  });

  it("validação do perfil falha: 400 e nada é criado", async () => {
    const dados = conta("LOCATARIO");
    const res = await registrar({ ...dados, locatario: perfilLocatario({ cpf: "12345678900" }) });
    expect(res.status).toBe(400);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("perfil de outro cargo é recusado", async () => {
    const dados = conta("LOCATARIO");
    const res = await registrar({ ...dados, locador: { empresa: "Empresa X", cnpj: uniqueCnpj() } });
    expect(res.status).toBe(400);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("constraint do perfil falha depois de inserir a Conta: rollback completo", async () => {
    // Deficiência inexistente só é detectada pela FK, já dentro da transação.
    const dados = conta("LOCATARIO");
    const res = await registrar({
      ...dados,
      locatario: perfilLocatario({ deficiencia_id: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(res.status).toBe(404);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("erro proposital após criar a Conta (sem as checagens prévias do service): rollback completo", async () => {
    const dados = conta("LOCATARIO");
    const repo = new PrismaContaRepository();
    await expect(
      repo.create(
        { ...dados, cargo: "LOCATARIO", senha: "hash-de-teste" },
        { locatario: { cpf: existente.cpf, cnh: uniqueCnh(), rg: uniqueRg(), dataNascimento: new Date(DEFAULT_DATA_NASCIMENTO) } },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("cadastro legado sem perfil continua aceito (compatibilidade documentada)", async () => {
    const dados = conta("LOCATARIO");
    const res = await registrar(dados);
    expect(res.status).toBe(201);
    expect(res.body.result.locatario).toBeUndefined();
  });
});

describe("Task 10 — M-05: cadastro atômico do locador (RF02)", () => {
  let existente: LocadorContext;

  beforeAll(async () => {
    existente = await createLocador();
  });

  it("sucesso cria Conta + Locador numa operação, senha com hash e resposta sanitizada", async () => {
    const dados = conta("LOCADOR");
    const perfil = { empresa: `Locadora Atômica ${Date.now()}`, cnpj: uniqueCnpj() };
    const res = await registrar({ ...dados, locador: perfil });

    expect(res.status).toBe(201);
    expect(res.body.result.locador).toMatchObject(perfil);
    semSegredos(res.body);
    const salvo = await prisma.conta.findUniqueOrThrow({ where: { email: dados.email }, include: { locador: true } });
    expect(salvo.locador?.id).toBe(salvo.id);
    expect(salvo.senhaHash).toMatch(/^\$2[aby]\$10\$/);
  });

  it("CNPJ duplicado: 409 e nenhuma Conta criada", async () => {
    const dados = conta("LOCADOR");
    const res = await registrar({ ...dados, locador: { empresa: `Outra ${Date.now()}`, cnpj: existente.cnpj } });
    expect(res.status).toBe(409);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("e-mail duplicado: 409 e nenhum Locador criado", async () => {
    const cnpj = uniqueCnpj();
    const res = await registrar({ ...conta("LOCADOR", existente.email), locador: { empresa: `Nova ${Date.now()}`, cnpj } });
    expect(res.status).toBe(409);
    expect(await prisma.locador.count({ where: { cnpj } })).toBe(0);
  });

  it("validação do perfil falha: 400 e nada é criado", async () => {
    const dados = conta("LOCADOR");
    const res = await registrar({ ...dados, locador: { empresa: "Empresa Y", cnpj: "11111111111111" } });
    expect(res.status).toBe(400);
    expect(await contasCom(dados.email)).toBe(0);
  });

  it("erro de constraint do Locador após inserir a Conta: rollback completo", async () => {
    const dados = conta("LOCADOR");
    const repo = new PrismaContaRepository();
    await expect(
      repo.create({ ...dados, cargo: "LOCADOR", senha: "hash-de-teste" }, { locador: { empresa: "Qualquer", cnpj: existente.cnpj } }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await contasCom(dados.email)).toBe(0);
  });
});
