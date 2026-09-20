import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/database/prisma";
import { PrismaRecuperacaoSenhaRepository } from "../../src/repositories/prisma/prisma.recuperacao-senha.repository";
import { createAccount } from "../helpers";

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
