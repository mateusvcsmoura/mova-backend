import { CanalNotificacao, StatusPagamento, TipoNotificacao } from "@prisma/client";

import { ReservaResponse } from "../repositories/contracts/reserva.contract.js";
import { INotificacaoRepository } from "../repositories/notificacao.repository.js";
import { IPreferenciaChecker } from "../repositories/preferencia-notificacao.repository.js";
import { IMailProvider } from "../infra/email/mail-provider.js";
import { retryComBackoff } from "../shared/retry.js";
import { ReservaReportService } from "./reserva-report.js";

export interface IReservaNotifier {
  notificarReservaConfirmada(reserva: ReservaResponse): Promise<void>;
}

export class NotificacaoReservaService implements IReservaNotifier {
  constructor(
    private readonly reportService: ReservaReportService,
    private readonly mailProvider: IMailProvider,
    private readonly notificacaoRepository: INotificacaoRepository,
    private readonly preferenciaChecker?: IPreferenciaChecker,
  ) {}

  async notificarReservaConfirmada(reserva: ReservaResponse): Promise<void> {
    // Só notifica quando o pagamento está confirmado.
    if (reserva.statusPagamento !== StatusPagamento.SUCESSO) {
      return;
    }

    // Respeita a preferência do locatário (opt-out de e-mail de reserva).
    if (
      this.preferenciaChecker &&
      !(await this.preferenciaChecker.estaHabilitada(
        reserva.idLocatario,
        CanalNotificacao.EMAIL,
        TipoNotificacao.RESERVA,
      ))
    ) {
      console.info(
        `[notificacao] locatário optou por não receber e-mail de reserva — reserva ${reserva.id}`,
      );
      return;
    }

    // Sem provedor configurado (dev/testes): não tenta enviar nem registra.
    if (!this.mailProvider.isEnabled()) {
      console.info(
        `[notificacao] envio desabilitado (SMTP não configurado) — reserva ${reserva.id}`,
      );
      return;
    }

    try {
      const { payload, content } = await this.reportService.buildReport(
        reserva,
      );

      const registro = await this.notificacaoRepository.registrar({
        idReserva: reserva.id,
        destinatario: payload.locatario.email,
        assunto: content.subject,
      });

      try {
        await retryComBackoff(() =>
          this.mailProvider.send({
            to: payload.locatario.email,
            subject: content.subject,
            html: content.html,
            text: content.text,
          }),
        );
        await this.notificacaoRepository.marcarEnviada(registro.id, new Date());
        console.info(
          `[notificacao] relatório enviado — reserva ${reserva.id} (registro ${registro.id})`,
        );
      } catch (sendError) {
        const mensagem =
          sendError instanceof Error ? sendError.message : String(sendError);
        await this.notificacaoRepository.marcarFalha(registro.id, mensagem);
        console.error(
          `[notificacao] falha ao enviar relatório — reserva ${reserva.id}: ${mensagem}`,
        );
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[notificacao] erro ao processar notificação — reserva ${reserva.id}: ${mensagem}`,
      );
    }
  }
}
