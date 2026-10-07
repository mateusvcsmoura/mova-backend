import { StatusNotificacao } from "@prisma/client";

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
