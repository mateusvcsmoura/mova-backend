import { Localizacao } from "@prisma/client";
import { LocalizacaoResponse } from "../contracts/localizacao.contract.js";

export class LocalizacaoMapper {
  static toResponse(localizacao: Localizacao): LocalizacaoResponse {
    return {
      id: localizacao.id,
      idVeiculo: localizacao.idVeiculo,
      // Prisma.Decimal -> number para a resposta da API
      latitude: Number(localizacao.latitude),
      longitude: Number(localizacao.longitude),
      dataHora: localizacao.dataHora,
      atualizadoEm: localizacao.atualizadoEm,
    };
  }

  static toManyResponse(localizacoes: Localizacao[]): LocalizacaoResponse[] {
    return localizacoes.map((l) => this.toResponse(l));
  }
}
