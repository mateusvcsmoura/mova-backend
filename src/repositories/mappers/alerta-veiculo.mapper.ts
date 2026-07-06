import { AlertaVeiculo } from "@prisma/client";
import { AlertaVeiculoResponse } from "../contracts/monitoramento.contract.js";

export class AlertaVeiculoMapper {
  static toResponse(alerta: AlertaVeiculo): AlertaVeiculoResponse {
    return {
      id: alerta.id,
      tipo: alerta.tipo,
      idVeiculo: alerta.idVeiculo,
      idLocador: alerta.idLocador,
      descricao: alerta.descricao,
      destinatario: alerta.destinatario,
      assunto: alerta.assunto,
      canal: alerta.canal,
      status: alerta.status,
      mensagemErro: alerta.mensagemErro,
      tentativas: alerta.tentativas,
      criadoEm: alerta.criadoEm,
      enviadoEm: alerta.enviadoEm,
      resolvidoEm: alerta.resolvidoEm,
      atualizadoEm: alerta.atualizadoEm,
    };
  }

  static toManyResponse(alertas: AlertaVeiculo[]): AlertaVeiculoResponse[] {
    return alertas.map((a) => this.toResponse(a));
  }
}
