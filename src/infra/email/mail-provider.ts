export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  // Versão em texto puro (clientes que não renderizam HTML). Opcional.
  text?: string;
}

export interface SendMailResult {
  // Identificador da mensagem retornado pelo provedor, quando disponível.
  messageId?: string;
}

export interface IMailProvider {
  isEnabled(): boolean;
  send(input: SendMailInput): Promise<SendMailResult>;
}
