import { ServicoOpcional } from "@prisma/client";
import {
  PublicServicoOpcionalResponse,
  ServicoOpcionalResponse,
} from "../contracts/servico-opcional.contract.js";

export class ServicoOpcionalMapper {
  static toPublicResponse(
    servico: ServicoOpcionalResponse,
  ): PublicServicoOpcionalResponse {
    return {
      id: servico.id,
      nome: servico.nome,
      descricao: servico.descricao,
      detalhesCobertura: servico.detalhesCobertura,
      valor: servico.valor,
    };
  }

  static toResponse(servico: ServicoOpcional): ServicoOpcionalResponse {
    return {
      id: servico.id,
      nome: servico.nome,
      descricao: servico.descricao,
      detalhesCobertura: servico.detalhesCobertura ?? null,
      // Prisma.Decimal -> number para a resposta da API
      valor: Number(servico.valor),
      ativo: servico.ativo,
      criadoEm: servico.criadoEm,
      atualizadoEm: servico.atualizadoEm,
    };
  }

  static toManyResponse(servicos: ServicoOpcional[]): ServicoOpcionalResponse[] {
    return servicos.map((s) => this.toResponse(s));
  }
}
