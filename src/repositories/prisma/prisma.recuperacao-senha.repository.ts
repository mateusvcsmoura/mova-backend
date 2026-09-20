import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import {
  IRecuperacaoSenhaRepository,
  RecuperacaoSenhaPersistida,
} from "../recuperacao-senha.repository.js";

const PERSISTED_SELECT = {
  id: true,
  idConta: true,
  tokenHash: true,
  expiraEm: true,
  usadoEm: true,
  criadoEm: true,
} satisfies Prisma.RecuperacaoSenhaSelect;

export class PrismaRecuperacaoSenhaRepository
  implements IRecuperacaoSenhaRepository
{
  async criarNova(
    idConta: string,
    tokenHash: string,
    expiraEm: Date,
    agora: Date,
  ): Promise<RecuperacaoSenhaPersistida> {
    return prisma.$transaction(async (tx) => {
      // Serializa solicitações simultâneas para a mesma conta: o último token
      // criado é o único que permanece ativo.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${idConta}, 0))
      `;

      await tx.recuperacaoSenha.updateMany({
        where: { idConta, usadoEm: null },
        data: { usadoEm: agora },
      });

      return tx.recuperacaoSenha.create({
        data: { idConta, tokenHash, expiraEm },
        select: PERSISTED_SELECT,
      });
    });
  }

  async consumirComNovaSenha(
    tokenHash: string,
    novaSenhaHash: string,
    agora: Date,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const encontrado = await tx.recuperacaoSenha.findFirst({
        where: {
          tokenHash,
          usadoEm: null,
          expiraEm: { gt: agora },
        },
        select: { id: true, idConta: true },
      });

      if (!encontrado) return false;

      // A condição repetida no update torna o claim atômico: em uma corrida,
      // exatamente uma transação consegue marcar usadoEm.
      const consumido = await tx.recuperacaoSenha.updateMany({
        where: {
          id: encontrado.id,
          usadoEm: null,
          expiraEm: { gt: agora },
        },
        data: { usadoEm: agora },
      });

      if (consumido.count !== 1) return false;

      await tx.conta.update({
        where: { id: encontrado.idConta },
        data: { senhaHash: novaSenhaHash },
      });

      return true;
    });
  }
}
