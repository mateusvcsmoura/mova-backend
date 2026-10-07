import { StatusReserva } from "@prisma/client";

// ── Relatório de reservas (RF17) ────────────────────────────────────────────
export interface RelatorioReservaItem {
  id: string;
  idVeiculo: string;
  idGaragemRetirada: string | null;
  garagemRetirada: {
    id: string;
    nome: string;
  } | null;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  status: string;
  statusPagamento: string;
  valorTotal: number;
  veiculo: {
    placa: string;
    marca: string;
    modelo: string;
  };
}

export interface RelatorioReservasFiltros {
  idVeiculo?: string;
  status?: StatusReserva;
  dataInicio?: Date;
  dataFim?: Date;
  page: number;
  limit: number;
}

export interface RelatorioReservas {
  total: number;
  aguardandoPagamento: number;
  confirmadas: number;
  emAndamento: number;
  concluidas: number; // StatusReserva.REALIZADA
  canceladas: number;
  reservas: RelatorioReservaItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Relatório financeiro (RF17) ─────────────────────────────────────────────
export interface FaturamentoPorVeiculo {
  idVeiculo: string;
  placa: string;
  total: number;
}

export interface FaturamentoPorPeriodo {
  periodo: string; // "YYYY-MM"
  total: number;
}

export interface RelatorioFinanceiro {
  faturamentoBruto: number;
  porPeriodo: FaturamentoPorPeriodo[];
  porVeiculo: FaturamentoPorVeiculo[];
}

// ── Utilização da frota (RF17) ──────────────────────────────────────────────
export interface UtilizacaoVeiculo {
  idVeiculo: string;
  placa: string;
  reservas: number;
  horasReservadas: number;
}

export interface RelatorioUtilizacao {
  totalVeiculos: number;
  // Veículos com alocação física válida; é o denominador da ocupação.
  veiculosAlocados: number;
  veiculosReservados: number;
  // Ocupação instantânea: reservas ativas em veículos alocados / veículos alocados (0..1).
  taxaOcupacao: number;
  // Duração média de uma reserva (não cancelada), em horas.
  tempoMedioReservadoHoras: number;
  maisUtilizados: UtilizacaoVeiculo[];
  menosUtilizados: UtilizacaoVeiculo[];
}

// ── Dashboard da frota (RF18) ───────────────────────────────────────────────
export interface UltimaLocalizacaoVeiculo {
  idVeiculo: string;
  placa: string;
  latitude: number;
  longitude: number;
  dataHora: Date;
}

export interface FrotaDashboard {
  veiculos: {
    total: number;
    disponivel: number;
    reservado: number;
    manutencao: number;
    inativo: number;
  };
  alertasAtivos: number;
  alertasPorTipo: {
    INATIVIDADE: number;
    BAIXA_AVALIACAO: number;
  };
  ultimasLocalizacoes: UltimaLocalizacaoVeiculo[];
}
