import { ServicoOpcional } from "@prisma/client";
import { ServicoOpcionalResponse } from "../contracts/servico-opcional.contract.js";

export class ServicoOpcionalMapper {
  static toResponse(servico: ServicoOpcional): ServicoOpcionalResponse {
    return {
      id: servico.id,
      nome: servico.nome,
      descricao: servico.descricao,
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
