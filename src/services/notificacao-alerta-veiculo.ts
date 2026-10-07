import { CanalNotificacao, TipoNotificacao } from "@prisma/client";

import { IMailProvider } from "../infra/email/mail-provider.js";
import { AlertaVeiculoResponse } from "../repositories/contracts/monitoramento.contract.js";
import { IMonitoramentoVeiculoRepository } from "../repositories/monitoramento.repository.js";
import { IPreferenciaChecker } from "../repositories/preferencia-notificacao.repository.js";
import { AlertaVeiculoContent } from "./contracts/alerta-veiculo.js";

export interface IAlertaVeiculoDispatcher {
  enviar(
    alerta: AlertaVeiculoResponse,
    content: AlertaVeiculoContent,
  ): Promise<boolean>;
}

export class NotificacaoAlertaVeiculoService implements IAlertaVeiculoDispatcher {
  constructor(
    private readonly monitoramentoRepository: IMonitoramentoVeiculoRepository,
    private readonly mailProvider: IMailProvider,
    private readonly preferenciaChecker?: IPreferenciaChecker,
  ) {}

  async enviar(
    alerta: AlertaVeiculoResponse,
    content: AlertaVeiculoContent,
  ): Promise<boolean> {
    if (
      this.preferenciaChecker &&
      !(await this.preferenciaChecker.estaHabilitada(
        alerta.idLocador,
        CanalNotificacao.EMAIL,
        TipoNotificacao.ALERTA_VEICULO,
      ))
    ) {
      await this.monitoramentoRepository.marcarEnviado(alerta.id, new Date());
      console.info(
        `[monitoramento] locador optou por não receber alerta — alerta ${alerta.id} (pulado, sem envio)`,
      );
      return true;
    }

    if (!this.mailProvider.isEnabled()) {
      console.info(
        `[monitoramento] envio desabilitado (SMTP não configurado) — alerta ${alerta.id}`,
      );
      return false;
    }

    try {
      await this.mailProvider.send({
        to: alerta.destinatario,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.monitoramentoRepository.marcarEnviado(alerta.id, new Date());
      console.info(
        `[monitoramento] alerta enviado — ${alerta.tipo} veículo ${alerta.idVeiculo} (alerta ${alerta.id})`,
      );
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      try {
        await this.monitoramentoRepository.marcarFalha(alerta.id, mensagem);
      } catch (persistError) {
        console.error(
          `[monitoramento] falha ao registrar erro do alerta ${alerta.id}:`,
          persistError,
        );
      }
      console.error(
        `[monitoramento] falha ao enviar alerta ${alerta.id}: ${mensagem}`,
      );
      return false;
    }
  }
}
