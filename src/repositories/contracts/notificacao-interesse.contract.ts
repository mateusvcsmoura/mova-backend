import { StatusNotificacao } from "@prisma/client";

// Dados mínimos para registrar uma tentativa de notificação de disponibilidade
// (status inicial PENDENTE). O status final é definido depois via
// marcarEnviada/marcarFalha.
export interface RegistrarNotificacaoInteresseRequest {
  idInteresse: string;
  destinatario: string;
  assunto: string;
  // Canal de envio; default EMAIL no repositório.
  canal?: string;
}

export interface NotificacaoInteresseResponse {
  id: string;
  idInteresse: string;
  destinatario: string;
  assunto: string;
  canal: string;
  status: StatusNotificacao;
  mensagemErro: string | null;
  criadaEm: Date;
  enviadaEm: Date | null;
  atualizadoEm: Date;
}
