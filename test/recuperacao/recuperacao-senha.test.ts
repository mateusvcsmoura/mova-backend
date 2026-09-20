import crypto from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../src/database/prisma";
import { env } from "../../src/config/env";
import { PrismaRecuperacaoSenhaRepository } from "../../src/repositories/prisma/prisma.recuperacao-senha.repository";
import { mailProvider } from "../../src/routes/container";
import { app } from "../../src/app";
import { createAccount, DEFAULT_SENHA, uniqueEmail } from "../helpers";

const RESET_MESSAGE =
  "Se existir uma conta associada a este e-mail, enviaremos as instruções de recuperação.";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenFromLastEmail(mails: Array<{ html: string; text?: string }>) {
  const content = `${mails.at(-1)?.html ?? ""} ${mails.at(-1)?.text ?? ""}`;
  const match = content.match(/[?&]token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("Token de teste não encontrado no e-mail fake");
  return match[1];
}

describe("RecuperacaoSenha — persistência do token", () => {
  const repository = new PrismaRecuperacaoSenhaRepository();

  beforeEach(async () => {
    await prisma.recuperacaoSenha.deleteMany();
  });

  it("persiste somente o hash e cria a recuperação vinculada à conta", async () => {
    const account = await createAccount("LOCATARIO");
    const tokenBruto = "token-bruto-apenas-no-servico";
    const tokenHash = "hash-sha256-do-token";
    const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

    const created = await repository.criarNova(
      account.conta.id,
      tokenHash,
      expiraEm,
      new Date(),
    );

    expect(created.idConta).toBe(account.conta.id);
    expect(created.tokenHash).toBe(tokenHash);
    expect(created.tokenHash).not.toBe(tokenBruto);
    expect(created.expiraEm.getTime()).toBe(expiraEm.getTime());

    const persisted = await prisma.recuperacaoSenha.findUnique({
      where: { id: created.id },
    });
    expect(persisted?.tokenHash).toBe(tokenHash);
    expect(persisted?.usadoEm).toBeNull();
  });
});

describe("RecuperacaoSenha — contrato HTTP", () => {
  const mails: Array<{ to: string; html: string; text?: string }> = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    mails.length = 0;
    vi.spyOn(mailProvider, "isEnabled").mockReturnValue(true);
    vi.spyOn(mailProvider, "send").mockImplementation(async (input) => {
      mails.push(input);
      return { messageId: "fake-reset-message" };
    });
  });

  it("responde de forma equivalente para e-mail existente e inexistente", async () => {
    const account = await createAccount("LOCATARIO");
    const existente = await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const inexistente = await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: uniqueEmail("nao-existente") });

    expect(existente.status).toBe(200);
    expect(inexistente.status).toBe(200);
    expect(existente.body.result.message).toBe(RESET_MESSAGE);
    expect(inexistente.body.result.message).toBe(RESET_MESSAGE);
    expect(JSON.stringify(existente.body)).not.toContain(account.email);
    expect(JSON.stringify(inexistente.body)).not.toContain(account.email);
  });

  it("rejeita e-mail inválido sem revelar conta", async () => {
    const response = await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: "nao-e-email" });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain("cadastr");
  });

  it("envia token aleatório, persiste somente hash e respeita TTL", async () => {
    const account = await createAccount("LOCATARIO");
    const antes = Date.now();
    const response = await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const depois = Date.now();
    const token = tokenFromLastEmail(mails);

    expect(response.status).toBe(200);
    expect(response.body.result.message).toBe(RESET_MESSAGE);
    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(token.length).toBeGreaterThanOrEqual(40);

    const persisted = await prisma.recuperacaoSenha.findFirst({
      where: { idConta: account.conta.id },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.tokenHash).toBe(hashToken(token));
    expect(persisted?.tokenHash).not.toBe(token);
    expect(persisted?.expiraEm.getTime()).toBeGreaterThanOrEqual(
      antes + env.PASSWORD_RESET_TTL_MINUTES * 60_000,
    );
    expect(persisted?.expiraEm.getTime()).toBeLessThanOrEqual(
      depois + env.PASSWORD_RESET_TTL_MINUTES * 60_000,
    );
  });

  it("nova solicitação invalida o token anterior", async () => {
    const account = await createAccount("LOCATARIO");
    await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const tokenAnterior = tokenFromLastEmail(mails);

    await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const tokenAtual = tokenFromLastEmail(mails);

    expect(tokenAtual).not.toBe(tokenAnterior);
    const anterior = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token: tokenAnterior, novaSenha: "NovaSenha#456" });
    const atual = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token: tokenAtual, novaSenha: "NovaSenha#456" });

    expect(anterior.status).toBe(400);
    expect(atual.status).toBe(204);
  });

  it("redefine a senha, invalida o token e permite login somente com a nova", async () => {
    const account = await createAccount("LOCATARIO");
    await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const token = tokenFromLastEmail(mails);
    const novaSenha = "SenhaRecuperada#789";

    const reset = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token, novaSenha });
    const repetido = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token, novaSenha: "OutraSenha#123" });
    const loginAntigo = await request(app)
      .post("/api/conta/auth/login")
      .send({ email: account.email, senha: DEFAULT_SENHA });
    const loginNovo = await request(app)
      .post("/api/conta/auth/login")
      .send({ email: account.email, senha: novaSenha });

    expect(reset.status).toBe(204);
    expect(repetido.status).toBe(400);
    expect(loginAntigo.status).toBe(401);
    expect(loginNovo.status).toBe(200);
    const persisted = await prisma.recuperacaoSenha.findFirst({
      where: { tokenHash: hashToken(token) },
    });
    expect(persisted?.usadoEm).not.toBeNull();
  });

  it("rejeita token inexistente, expirado e senha fora da política", async () => {
    const account = await createAccount("LOCATARIO");
    await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const token = tokenFromLastEmail(mails);

    const fraca = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token, novaSenha: "fraca" });
    await prisma.recuperacaoSenha.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiraEm: new Date(Date.now() - 1) },
    });
    const expirado = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token, novaSenha: "SenhaValida#123" });
    const inexistente = await request(app)
      .post("/api/conta/auth/reset-password")
      .send({ token: "token-inexistente-com-tamanho-suficiente", novaSenha: "SenhaValida#123" });

    expect(fraca.status).toBe(400);
    expect(expirado.status).toBe(400);
    expect(inexistente.status).toBe(400);
  });

  it("permite somente um consumo lógico em reset concorrente", async () => {
    const account = await createAccount("LOCATARIO");
    await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });
    const token = tokenFromLastEmail(mails);

    const respostas = await Promise.all([
      request(app)
        .post("/api/conta/auth/reset-password")
        .send({ token, novaSenha: "SenhaConcorrenteA#123" }),
      request(app)
        .post("/api/conta/auth/reset-password")
        .send({ token, novaSenha: "SenhaConcorrenteB#123" }),
    ]);

    expect(respostas.filter((response) => response.status === 204)).toHaveLength(1);
    expect(respostas.filter((response) => response.status === 400)).toHaveLength(1);
    const logins = await Promise.all([
      request(app).post("/api/conta/auth/login").send({ email: account.email, senha: "SenhaConcorrenteA#123" }),
      request(app).post("/api/conta/auth/login").send({ email: account.email, senha: "SenhaConcorrenteB#123" }),
    ]);
    expect(logins.filter((response) => response.status === 200)).toHaveLength(1);
  });

  it("não chama SMTP quando provider está desabilitado e mantém resposta genérica", async () => {
    const account = await createAccount("LOCATARIO");
    vi.spyOn(mailProvider, "isEnabled").mockReturnValue(false);
    const send = vi.spyOn(mailProvider, "send");

    const response = await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });

    expect(response.status).toBe(200);
    expect(response.body.result.message).toBe(RESET_MESSAGE);
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain("token");
  });

  it("mantém resposta genérica quando o provider falha sem expor token", async () => {
    const account = await createAccount("LOCATARIO");
    let enviado = "";
    vi.spyOn(mailProvider, "send").mockImplementation(async (input) => {
      enviado = input.html;
      throw new Error("SMTP indisponível");
    });

    const response = await request(app)
      .post("/api/conta/auth/forgot-password")
      .send({ email: account.email });

    expect(response.status).toBe(200);
    expect(response.body.result.message).toBe(RESET_MESSAGE);
    expect(enviado).toContain("redefinir-senha");
    expect(JSON.stringify(response.body)).not.toContain("token=");
  });
});
