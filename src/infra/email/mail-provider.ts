// Camada de infraestrutura de e-mail. A regra de negócio depende apenas desta
// abstração — nunca de um provedor concreto. Trocar Nodemailer por Amazon SES,
// Resend, SendGrid etc. significa apenas criar outra implementação de
// IMailProvider e trocar o registro no container, sem tocar nos services.

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
  // Indica se o provedor está configurado e apto a enviar. Quando false, a
  // camada de notificação simplesmente não tenta enviar (dev/testes).
  isEnabled(): boolean;
  // Envia o e-mail. Deve lançar em caso de falha (SMTP indisponível, recusa
  // do provedor etc.) — o tratamento fica a cargo de quem chama.
  send(input: SendMailInput): Promise<SendMailResult>;
}
