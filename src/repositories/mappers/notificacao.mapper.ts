import { NotificacaoReserva } from "@prisma/client";

import { NotificacaoResponse } from "../contracts/notificacao.contract.js";

export class NotificacaoMapper {
  static toResponse(n: NotificacaoReserva): NotificacaoResponse {
    return {
      id: n.id,
      idReserva: n.idReserva,
      destinatario: n.destinatario,
      assunto: n.assunto,
      canal: n.canal,
      status: n.status,
      mensagemErro: n.mensagemErro,
      criadaEm: n.criadaEm,
      enviadaEm: n.enviadaEm,
      atualizadoEm: n.atualizadoEm,
    };
  }

  static toManyResponse(
    notificacoes: NotificacaoReserva[],
  ): NotificacaoResponse[] {
    return notificacoes.map((n) => this.toResponse(n));
  }
}
