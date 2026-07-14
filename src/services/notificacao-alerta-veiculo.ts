import { CanalNotificacao, TipoNotificacao } from "@prisma/client";

import { IMailProvider } from "../infra/email/mail-provider.js";
import { AlertaVeiculoResponse } from "../repositories/contracts/monitoramento.contract.js";
import { IMonitoramentoVeiculoRepository } from "../repositories/monitoramento.repository.js";
import { IPreferenciaChecker } from "../repositories/preferencia-notificacao.repository.js";
import { AlertaVeiculoContent } from "./contracts/alerta-veiculo.js";

// Contrato mínimo do qual o serviço de monitoramento depende para despachar
// alertas. Novos canais (push/SMS/WhatsApp) entram como outras implementações,
// sem alterar as regras de monitoramento.
export interface IAlertaVeiculoDispatcher {
  // Envia o alerta e atualiza o registro (ENVIADA/FALHA). Retorna true quando
  // o provedor aceitou a mensagem. NUNCA lança.
  enviar(
    alerta: AlertaVeiculoResponse,
    content: AlertaVeiculoContent,
  ): Promise<boolean>;
}

// Fronteira de envio dos alertas: e-mail via IMailProvider + atualização do
// registro. É a fronteira de tratamento de erros do canal: falha de SMTP é
// registrada (FALHA + mensagemErro) e logada, mas não propaga — a rotina de
// monitoramento continua com os demais alertas.
export class NotificacaoAlertaVeiculoService implements IAlertaVeiculoDispatcher {
  constructor(
    private readonly monitoramentoRepository: IMonitoramentoVeiculoRepository,
    private readonly mailProvider: IMailProvider,
    // RN10: opcional. Quando presente, respeita o opt-out do locador para
    // ALERTA_VEICULO. Ausente (testes antigos) mantém o envio de sempre.
    private readonly preferenciaChecker?: IPreferenciaChecker,
  ) {}

  async enviar(
    alerta: AlertaVeiculoResponse,
    content: AlertaVeiculoContent,
  ): Promise<boolean> {
    // RN10: respeita o opt-out do locador (destinatário do alerta). Opt-out é
    // tratado como RESOLVIDO (marcado como enviado -> não reenvia), não como
    // falha: retorna true para não contar como falhaEnvio nem disparar retry.
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

    // Sem provedor configurado (dev/testes): o alerta permanece PENDENTE e
    // será reencaminhado na próxima execução da rotina.
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
        `[monitoramento] alerta enviado — ${alerta.tipo} veículo ${alerta.idVeiculo} -> ${alerta.destinatario}`,
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
