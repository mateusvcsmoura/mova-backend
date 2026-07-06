// DTOs do dashboard do locador (RF17/RF18). Todos os dados são escopados aos
// veículos do locador autenticado (idLocador vem do token).

// ── Relatório de reservas (RF17) ────────────────────────────────────────────
export interface RelatorioReservas {
  total: number;
  aguardandoPagamento: number;
  confirmadas: number;
  emAndamento: number;
  concluidas: number; // StatusReserva.REALIZADA
  canceladas: number;
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
  // Considera apenas pagamentos confirmados (statusPagamento = SUCESSO).
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
  veiculosReservados: number;
  // Ocupação instantânea: veículos RESERVADO / total de veículos (0..1).
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
  ultimasLocalizacoes: UltimaLocalizacaoVeiculo[];
}
