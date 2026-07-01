import { Reserva, ReservaServico, ServicoOpcional } from "@prisma/client";
import { ReservaResponse } from "../contracts/reserva.contract.js";

// Reserva carregada com a junção de serviços (servicos -> servico do catálogo).
export type ReservaComServicos = Reserva & {
  servicos?: (ReservaServico & { servico: ServicoOpcional })[];
};

export class ReservaMapper {
  static toResponse(reserva: ReservaComServicos): ReservaResponse {
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
      servicos: (reserva.servicos ?? []).map((rs) => ({
        idServico: rs.idServico,
        nome: rs.servico.nome,
        descricao: rs.servico.descricao,
        // valor contratado (snapshot), não o valor atual do catálogo
        valor: Number(rs.valor),
      })),
      atualizadoEm: reserva.atualizadoEm,
    };
  }

  static toManyResponse(reservas: ReservaComServicos[]): ReservaResponse[] {
    return reservas.map((r) => this.toResponse(r));
  }
}
