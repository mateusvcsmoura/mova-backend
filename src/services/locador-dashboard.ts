import { ILocadorDashboardRepository } from "../repositories/locador-dashboard.repository.js";
import { RelatorioReservasFiltros } from "../repositories/contracts/locador-dashboard.contract.js";

// Dashboard do locador (RF17/RF18). Serviço fino: a autorização (LOCADOR) é
// feita na rota e o idLocador vem sempre do token, garantindo que o locador
// só enxerga dados dos próprios veículos.
export class LocadorDashboardService {
  constructor(private readonly repository: ILocadorDashboardRepository) {}

  relatorioReservas = (
    idLocador: string,
    filtros: RelatorioReservasFiltros,
  ) => this.repository.relatorioReservas(idLocador, filtros);

  relatorioFinanceiro = (idLocador: string) =>
    this.repository.relatorioFinanceiro(idLocador);

  relatorioUtilizacao = (idLocador: string) =>
    this.repository.relatorioUtilizacao(idLocador);

  frotaDashboard = (idLocador: string) =>
    this.repository.frotaDashboard(idLocador);
}
