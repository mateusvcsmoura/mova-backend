import {
  NotificacaoResponse,
  RegistrarNotificacaoRequest,
} from "./contracts/notificacao.contract.js";

export interface INotificacaoRepository {
  // Registra a tentativa de envio (status PENDENTE).
  registrar(data: RegistrarNotificacaoRequest): Promise<NotificacaoResponse>;
  // Marca o envio como concluído com sucesso (status ENVIADA).
  marcarEnviada(id: string, enviadaEm: Date): Promise<NotificacaoResponse>;
  // Persiste a falha do envio (status FALHA + mensagem de erro).
  marcarFalha(id: string, mensagemErro: string): Promise<NotificacaoResponse>;
  // Consulta o histórico de notificações de uma reserva (auditoria/status).
  findByReserva(idReserva: string): Promise<NotificacaoResponse[]>;
}
