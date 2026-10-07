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
