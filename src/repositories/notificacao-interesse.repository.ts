import {
  NotificacaoInteresseResponse,
  RegistrarNotificacaoInteresseRequest,
} from "./contracts/notificacao-interesse.contract.js";

export interface INotificacaoInteresseRepository {
  registrar(
    data: RegistrarNotificacaoInteresseRequest,
  ): Promise<NotificacaoInteresseResponse>;
  marcarEnviada(
    id: string,
    enviadaEm: Date,
  ): Promise<NotificacaoInteresseResponse>;
  marcarFalha(
    id: string,
    mensagemErro: string,
  ): Promise<NotificacaoInteresseResponse>;
  // Histórico de envios de uma inscrição (auditoria).
  findByInteresse(idInteresse: string): Promise<NotificacaoInteresseResponse[]>;
}
