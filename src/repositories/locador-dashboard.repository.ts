import {
  FrotaDashboard,
  RelatorioFinanceiro,
  RelatorioReservas,
  RelatorioUtilizacao,
} from "./contracts/locador-dashboard.contract.js";

// Todas as consultas são escopadas aos veículos do locador (idLocador).
export interface ILocadorDashboardRepository {
  relatorioReservas(idLocador: string): Promise<RelatorioReservas>;
  relatorioFinanceiro(idLocador: string): Promise<RelatorioFinanceiro>;
  relatorioUtilizacao(idLocador: string): Promise<RelatorioUtilizacao>;
  frotaDashboard(idLocador: string): Promise<FrotaDashboard>;
}
