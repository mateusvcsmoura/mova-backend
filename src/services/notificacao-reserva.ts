import { StatusPagamento } from "@prisma/client";

import { ReservaResponse } from "../repositories/contracts/reserva.contract.js";
import { INotificacaoRepository } from "../repositories/notificacao.repository.js";
import { IMailProvider } from "../infra/email/mail-provider.js";
import { ReservaReportService } from "./reserva-report.js";

// Contrato mínimo do qual a regra de negócio da reserva depende. Mantém o
// ReservaService desacoplado da implementação concreta de notificação/e-mail.
export interface IReservaNotifier {
  notificarReservaConfirmada(reserva: ReservaResponse): Promise<void>;
}

// Orquestra o envio do relatório de reserva por e-mail:
//   monta o payload -> gera o template -> registra a tentativa -> envia ->
//   atualiza o registro (sucesso/falha).
//
// É a fronteira de tratamento de erros: NUNCA lança. Qualquer falha (SMTP
// indisponível, provedor recusando, erro ao montar payload) é registrada e
// logada, mas não propaga — a reserva já concluída não pode ser afetada pelo
// envio do e-mail.
export class NotificacaoReservaService implements IReservaNotifier {
  constructor(
    private readonly reportService: ReservaReportService,
    private readonly mailProvider: IMailProvider,
    private readonly notificacaoRepository: INotificacaoRepository,
  ) {}

  async notificarReservaConfirmada(reserva: ReservaResponse): Promise<void> {
    // Só notifica quando o pagamento está confirmado.
    if (reserva.statusPagamento !== StatusPagamento.SUCESSO) {
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

      // Registra a tentativa (PENDENTE) antes de enviar — auditoria mesmo que
      // o processo caia no meio do envio.
      const registro = await this.notificacaoRepository.registrar({
        idReserva: reserva.id,
        destinatario: payload.locatario.email,
        assunto: content.subject,
      });

      try {
        await this.mailProvider.send({
          to: payload.locatario.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
        await this.notificacaoRepository.marcarEnviada(registro.id, new Date());
        console.info(
          `[notificacao] relatório enviado — reserva ${reserva.id} -> ${payload.locatario.email}`,
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
      // Falha antes/fora do envio (montagem do payload, persistência do
      // registro etc.). Loga e segue — a reserva não é afetada.
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[notificacao] erro ao processar notificação — reserva ${reserva.id}: ${mensagem}`,
      );
    }
  }
}
