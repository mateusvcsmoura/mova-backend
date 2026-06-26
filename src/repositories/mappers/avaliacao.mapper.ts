import { Avaliacao } from "@prisma/client";
import { AvaliacaoResponse } from "../contracts/avaliacao.contract.js";

export class AvaliacaoMapper {
  static toResponse(avaliacao: Avaliacao): AvaliacaoResponse {
    return {
      id: avaliacao.id,
      idReserva: avaliacao.idReserva,
      // Prisma.Decimal -> number para a resposta da API
      nota: Number(avaliacao.nota),
      comentario: avaliacao.comentario,
      data: avaliacao.data,
      atualizadoEm: avaliacao.atualizadoEm,
    };
  }

  static toManyResponse(avaliacoes: Avaliacao[]): AvaliacaoResponse[] {
    return avaliacoes.map((a) => this.toResponse(a));
  }
}
