import { createTransport, Transporter } from "nodemailer";

import {
  IMailProvider,
  SendMailInput,
  SendMailResult,
} from "./mail-provider.js";

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
}

// Implementação de IMailProvider via SMTP (Nodemailer). Projetada para o Gmail
// com App Password, mas funciona com qualquer SMTP. Quando a configuração está
// incompleta, o provedor fica desabilitado (isEnabled = false) e nunca envia —
// assim dev/testes rodam sem SMTP e sem enviar e-mails reais.
export class NodemailerMailProvider implements IMailProvider {
  private readonly config: SmtpConfig;
  // Transporter criado sob demanda (lazy) e reutilizado entre envios.
  private transporter: Transporter | null = null;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    const { host, port, user, pass, from } = this.config;
    return Boolean(host && port && user && pass && from);
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = createTransport({
      host: this.config.host,
      port: this.config.port,
      // 465 => conexão segura (SSL); demais portas usam STARTTLS.
      secure: this.config.port === 465,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    return this.transporter;
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.isEnabled()) {
      // Salvaguarda: quem chama já deve checar isEnabled(), mas garantimos que
      // um provedor não configurado nunca tente abrir conexão SMTP.
      throw new Error("Provedor de e-mail não configurado (SMTP ausente).");
    }

    const info = await this.getTransporter().sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return { messageId: info.messageId };
  }
}
