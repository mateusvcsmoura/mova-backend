import { NotificacaoInteresse } from "@prisma/client";
import { NotificacaoInteresseResponse } from "../contracts/notificacao-interesse.contract.js";

export class NotificacaoInteresseMapper {
  static toResponse(n: NotificacaoInteresse): NotificacaoInteresseResponse {
    return {
      id: n.id,
      idInteresse: n.idInteresse,
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
    notificacoes: NotificacaoInteresse[],
  ): NotificacaoInteresseResponse[] {
    return notificacoes.map((n) => this.toResponse(n));
  }
}
