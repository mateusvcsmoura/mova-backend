import { AcaoLgpd, Cargo } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import {
  AcessoDadoPessoalResponse,
  DadosPessoaisExport,
  ILgpdRepository,
} from "../repositories/lgpd.repository.js";

interface Autor {
  id: string;
  cargo: Cargo;
}

/**
 * Direitos LGPD do titular: portabilidade (exportação), anonimização (direito
 * ao esquecimento) e transparência (trilha de auditoria de acesso).
 *
 * Não remove funcionalidades: a anonimização preserva as linhas e o histórico
 * de negócio, apagando apenas o PII.
 */
export class LgpdService {
  constructor(private readonly lgpdRepository: ILgpdRepository) {}

  // Titular só acessa os próprios dados; ADMIN acessa os de qualquer um.
  private assertAcesso(idTitular: string, autor: Autor): void {
    if (autor.cargo !== Cargo.ADMIN && autor.id !== idTitular) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  exportar = async (
    idTitular: string,
    autor: Autor,
  ): Promise<DadosPessoaisExport> => {
    this.assertAcesso(idTitular, autor);

    const dados = await this.lgpdRepository.exportarDadosPessoais(idTitular);
    if (!dados) {
      throw new HttpError(404, "Conta não encontrada");
    }

    await this.lgpdRepository.registrarAcesso({
      idTitular,
      idAutor: autor.id,
      acao: AcaoLgpd.EXPORTAR,
    });

    return dados;
  };

  anonimizar = async (
    idTitular: string,
    autor: Autor,
  ): Promise<{ anonimizado: boolean }> => {
    this.assertAcesso(idTitular, autor);

    const ok = await this.lgpdRepository.anonimizarConta(idTitular);
    if (!ok) {
      throw new HttpError(404, "Conta não encontrada");
    }

    await this.lgpdRepository.registrarAcesso({
      idTitular,
      idAutor: autor.id,
      acao: AcaoLgpd.ANONIMIZAR,
    });

    return { anonimizado: true };
  };

  listarAcessos = async (
    idTitular: string,
    autor: Autor,
  ): Promise<AcessoDadoPessoalResponse[]> => {
    this.assertAcesso(idTitular, autor);
    return this.lgpdRepository.listarAcessos(idTitular);
  };
}
