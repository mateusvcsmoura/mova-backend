import {
  ModeloVeiculo,
  CobrancaReserva,
  TipoCobranca,
  Reserva,
  ReservaServico,
  ServicoOpcional,
  Veiculo,
  Garagem,
} from "@prisma/client";
import { ReservaResponse } from "../contracts/reserva.contract.js";
import { VeiculoMapper } from "./veiculo.mapper.js";

// Reserva carregada com a junção de serviços (servicos -> servico do catálogo)
// e com o veículo + modelo, conforme RESERVA_INCLUDE.
export type ReservaComServicos = Reserva & {
  servicos?: (ReservaServico & { servico: ServicoOpcional })[];
  cobrancas?: CobrancaReserva[];
  veiculo: Veiculo & { modeloVeiculo: ModeloVeiculo };
  garagemRetirada?: Pick<Garagem, "id" | "nome" | "endereco" | "status"> | null;
  garagemDevolucao?: Pick<Garagem, "id" | "nome" | "endereco" | "status"> | null;
};

export class ReservaMapper {
  static toResponse(reserva: ReservaComServicos): ReservaResponse {
    return {
      id: reserva.id,
      idVeiculo: reserva.idVeiculo,
      idLocatario: reserva.idLocatario,
      idGaragemRetirada: reserva.idGaragemRetirada,
      idGaragemDevolucao: reserva.idGaragemDevolucao,
      garagemRetirada: reserva.garagemRetirada ?? null,
      garagemDevolucao: reserva.garagemDevolucao ?? null,
      dataHoraInicio: reserva.dataHoraInicio,
      dataHoraFim: reserva.dataHoraFim,
      criadaEm: reserva.criadaEm,
      // Prisma.Decimal -> number para a resposta da API
      valorTotal: Number(reserva.valorTotal),
      status: reserva.status,
      statusPagamento: reserva.statusPagamento,
      metodoPagamento: reserva.metodoPagamento,
      codigoDesbloqueio: reserva.codigoDesbloqueio,
      codigoGeradoEm: reserva.codigoGeradoEm,
      codigoUsadoEm: reserva.codigoUsadoEm,
      devolvidoEm: reserva.devolvidoEm,
      cobrancaAtraso: (reserva.cobrancas ?? [])
        .filter((cobranca) => cobranca.tipo === TipoCobranca.ATRASO_DEVOLUCAO)
        .reduce((total, cobranca) => total + Number(cobranca.valor), 0),
      multaCancelamento: (reserva.cobrancas ?? [])
        .filter((cobranca) => cobranca.tipo === TipoCobranca.CANCELAMENTO)
        .reduce((total, cobranca) => total + Number(cobranca.valor), 0),
      servicos: (reserva.servicos ?? []).map((rs) => ({
        idServico: rs.idServico,
        nome: rs.servico.nome,
        descricao: rs.servico.descricao,
        // valor contratado (snapshot), não o valor atual do catálogo
        valor: Number(rs.valor),
      })),
      veiculo: VeiculoMapper.toResponse(reserva.veiculo),
      atualizadoEm: reserva.atualizadoEm,
    };
  }

  static toManyResponse(reservas: ReservaComServicos[]): ReservaResponse[] {
    return reservas.map((r) => this.toResponse(r));
  }
}
