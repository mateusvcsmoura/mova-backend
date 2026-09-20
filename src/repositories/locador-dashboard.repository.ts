import {
  FrotaDashboard,
  RelatorioFinanceiro,
  RelatorioReservas,
  RelatorioReservasFiltros,
  RelatorioUtilizacao,
} from "./contracts/locador-dashboard.contract.js";

// Todas as consultas são escopadas aos veículos do locador (idLocador).
export interface ILocadorDashboardRepository {
  relatorioReservas(
    idLocador: string,
    filtros: RelatorioReservasFiltros,
  ): Promise<RelatorioReservas>;
  relatorioFinanceiro(idLocador: string): Promise<RelatorioFinanceiro>;
  relatorioUtilizacao(idLocador: string): Promise<RelatorioUtilizacao>;
  frotaDashboard(idLocador: string): Promise<FrotaDashboard>;
}
