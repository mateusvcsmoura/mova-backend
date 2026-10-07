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
import {
  ReservaResponse,
  ReservaVeiculoResponse,
} from "../contracts/reserva.contract.js";
import { VeiculoMapper } from "./veiculo.mapper.js";

export type ReservaComServicos = Reserva & {
  servicos?: (ReservaServico & { servico: ServicoOpcional })[];
  cobrancas?: CobrancaReserva[];
  veiculo: Veiculo & { modeloVeiculo: ModeloVeiculo; garagem?: Pick<Garagem, "id" | "nome" | "status"> | null; imagens?: import("@prisma/client").VeiculoImagem[] };
  garagemRetirada?: Pick<Garagem, "id" | "nome" | "endereco" | "status"> | null;
  garagemDevolucao?: Pick<Garagem, "id" | "nome" | "endereco" | "status"> | null;
};

export type ReservaComServicosSemCodigo = Omit<
  ReservaComServicos,
  "codigoDesbloqueio"
>;

export class ReservaMapper {
  private static toResponseSemCodigo(
    reserva: ReservaComServicosSemCodigo,
  ): ReservaVeiculoResponse {
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
      codigoGeradoEm: reserva.codigoGeradoEm,
      codigoUsadoEm: reserva.codigoUsadoEm,
      devolvidoEm: reserva.devolvidoEm,
      expiradaEm: reserva.expiradaEm,
      cobrancaAtraso: (reserva.cobrancas ?? [])
        .filter((cobranca) => cobranca.tipo === TipoCobranca.ATRASO_DEVOLUCAO)
        .reduce((total, cobranca) => total + Number(cobranca.valor), 0),
      multaCancelamento: (reserva.cobrancas ?? [])
        .filter((cobranca) => cobranca.tipo === TipoCobranca.CANCELAMENTO)
        .reduce((total, cobranca) => total + Number(cobranca.valor), 0),
      servicos: (reserva.servicos ?? []).map((rs) => ({
        idServico: rs.idServico,
        nome: rs.nome ?? rs.servico.nome,
        descricao: rs.descricao ?? rs.servico.descricao,
        detalhesCobertura: rs.detalhesCobertura ?? rs.servico.detalhesCobertura ?? null,
        // valor contratado (snapshot), não o valor atual do catálogo
        valor: Number(rs.valor),
      })),
      veiculo: VeiculoMapper.toResponse(reserva.veiculo),
      atualizadoEm: reserva.atualizadoEm,
    };
  }

  static toResponse(reserva: ReservaComServicos): ReservaResponse {
    return {
      ...this.toResponseSemCodigo(reserva),
      codigoDesbloqueio: reserva.codigoDesbloqueio,
    };
  }

  static toVeiculoResponse(
    reserva: ReservaComServicosSemCodigo,
  ): ReservaVeiculoResponse {
    return this.toResponseSemCodigo(reserva);
  }

  static toLocadorResponse(
    reserva: ReservaResponse,
  ): ReservaVeiculoResponse {
    const { codigoDesbloqueio: _codigoDesbloqueio, ...semCodigo } = reserva;
    return semCodigo;
  }

  static toManyResponse(reservas: ReservaComServicos[]): ReservaResponse[] {
    return reservas.map((r) => this.toResponse(r));
  }

  static toManyVeiculoResponse(
    reservas: ReservaComServicosSemCodigo[],
  ): ReservaVeiculoResponse[] {
    return reservas.map((r) => this.toVeiculoResponse(r));
  }
}
