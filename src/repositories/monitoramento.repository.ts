import { StatusVeiculo, TipoAlertaVeiculo } from "@prisma/client";

import {
  AlertaVeiculoResponse,
  CriterioBaixaAvaliacao,
  RegistrarAlertaRequest,
  VeiculoBaixaAvaliacaoRow,
  VeiculoInativoRow,
} from "./contracts/monitoramento.contract.js";

// Contrato mínimo usado pelo VeiculoService para registrar transições de
// status sem depender do repositório de monitoramento completo.
export interface IVeiculoStatusRecorder {
  registrarStatus(idVeiculo: string, status: StatusVeiculo): Promise<void>;
}

export interface IMonitoramentoVeiculoRepository extends IVeiculoStatusRecorder {
  // Veículos INATIVO desde antes de `limite` (regra de inatividade).
  findVeiculosInativosDesde(limite: Date): Promise<VeiculoInativoRow[]>;
  // Veículos com avaliações recorrentes abaixo do esperado (agregação no banco).
  findVeiculosComBaixaAvaliacao(
    criterio: CriterioBaixaAvaliacao,
  ): Promise<VeiculoBaixaAvaliacaoRow[]>;

  registrarAlerta(data: RegistrarAlertaRequest): Promise<AlertaVeiculoResponse>;
  marcarEnviado(id: string, enviadoEm: Date): Promise<AlertaVeiculoResponse>;
  marcarFalha(id: string, mensagemErro: string): Promise<AlertaVeiculoResponse>;
  // Encerra o alerta (condição deixou de valer) — permite novo alerta em
  // reincidência futura.
  resolver(id: string, resolvidoEm: Date): Promise<AlertaVeiculoResponse>;

  // Alerta ativo (resolvidoEm IS NULL) por veículo/tipo — deduplicação.
  findAlertaAtivo(
    idVeiculo: string,
    tipo: TipoAlertaVeiculo,
  ): Promise<AlertaVeiculoResponse | null>;
  // Todos os alertas ativos de um tipo — usados na resolução automática.
  findAtivosByTipo(tipo: TipoAlertaVeiculo): Promise<AlertaVeiculoResponse[]>;
  // Histórico de alertas de um veículo (auditoria).
  findByVeiculo(idVeiculo: string): Promise<AlertaVeiculoResponse[]>;
}
