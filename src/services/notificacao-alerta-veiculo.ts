import { IMailProvider } from "../infra/email/mail-provider.js";
import { AlertaVeiculoResponse } from "../repositories/contracts/monitoramento.contract.js";
import { IMonitoramentoVeiculoRepository } from "../repositories/monitoramento.repository.js";
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
  ) {}

  async enviar(
    alerta: AlertaVeiculoResponse,
    content: AlertaVeiculoContent,
  ): Promise<boolean> {
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
