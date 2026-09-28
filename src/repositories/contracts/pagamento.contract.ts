import {
  MetodoPagamento,
  StatusPagamento,
  StatusReserva,
  TipoEventoFinanceiroSandbox,
} from "@prisma/client";

export type StatusEstorno =
  | "NAO_SOLICITADO"
  | "SOLICITADO"
  | "CONCLUIDO"
  | "FALHOU";

export interface PagamentoHistoricoItem {
  tipo: TipoEventoFinanceiroSandbox;
  criadoEm: Date;
}

export interface PagamentoReservaResponse {
  idReserva: string;
  statusReserva: StatusReserva;
  statusPagamento: StatusPagamento;
  metodoPagamento: MetodoPagamento | null;
  valorReserva: number;
  valorPago: number;
  multaCancelamento: number;
  valorElegivelEstorno: number;
  statusEstorno: StatusEstorno;
  estornoSolicitadoEm: Date | null;
  estornoConcluidoEm: Date | null;
  historico: PagamentoHistoricoItem[];
  simulado: true;
  aviso: "Pagamento e estorno simulados — nenhum dinheiro real movimentado";
  atualizadoEm: Date;
}
