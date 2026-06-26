import { Reserva } from "@prisma/client";
import { ReservaResponse } from "../contracts/reserva.contract.js";

export class ReservaMapper {
  static toResponse(reserva: Reserva): ReservaResponse {
    return {
      id: reserva.id,
      idVeiculo: reserva.idVeiculo,
      idLocatario: reserva.idLocatario,
      idGaragemRetirada: reserva.idGaragemRetirada,
      idGaragemDevolucao: reserva.idGaragemDevolucao,
      dataHoraInicio: reserva.dataHoraInicio,
      dataHoraFim: reserva.dataHoraFim,
      criadaEm: reserva.criadaEm,
      // Prisma.Decimal -> number para a resposta da API
      valorTotal: Number(reserva.valorTotal),
      status: reserva.status,
      statusPagamento: reserva.statusPagamento,
      codigoDesbloqueio: reserva.codigoDesbloqueio,
      codigoGeradoEm: reserva.codigoGeradoEm,
      codigoUsadoEm: reserva.codigoUsadoEm,
      atualizadoEm: reserva.atualizadoEm,
    };
  }

  static toManyResponse(reservas: Reserva[]): ReservaResponse[] {
    return reservas.map((r) => this.toResponse(r));
  }
}
