import { RecuperacaoSenha } from "@prisma/client";

export type RecuperacaoSenhaPersistida = Pick<
  RecuperacaoSenha,
  "id" | "idConta" | "tokenHash" | "expiraEm" | "usadoEm" | "criadoEm"
>;

export interface IRecuperacaoSenhaRepository {
  criarNova(
    idConta: string,
    tokenHash: string,
    expiraEm: Date,
    agora: Date,
  ): Promise<RecuperacaoSenhaPersistida>;

  consumirComNovaSenha(
    tokenHash: string,
    novaSenhaHash: string,
    agora: Date,
  ): Promise<boolean>;
}
