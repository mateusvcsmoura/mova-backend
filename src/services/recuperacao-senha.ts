import crypto from "node:crypto";
import bcrypt from "bcrypt";

import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { IContaRepository } from "../repositories/conta.repository.js";
import { IRecuperacaoSenhaRepository } from "../repositories/recuperacao-senha.repository.js";
import { IMailProvider } from "../infra/email/mail-provider.js";

export const RESET_PASSWORD_MESSAGE =
  "Se existir uma conta associada a este e-mail, enviaremos as instruções de recuperação.";

const TOKEN_INVALIDO_MESSAGE = "Token inválido ou expirado";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function frontendBaseUrl(): string | null {
  if (env.FRONTEND_URL) return env.FRONTEND_URL.replace(/\/$/, "");
  if (env.NODE_ENV !== "production") return "http://localhost:5173";
  return null;
}

export class RecuperacaoSenhaService {
  constructor(
    private readonly contaRepository: IContaRepository,
    private readonly recuperacaoRepository: IRecuperacaoSenhaRepository,
    private readonly mailProvider: IMailProvider,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async solicitar(email: string): Promise<void> {
    const conta = await this.contaRepository.findByEmail(email.trim());
    if (!conta) return;

    const token = crypto.randomBytes(32).toString("base64url");
    const agora = this.agora();
    const expiraEm = new Date(
      agora.getTime() + env.PASSWORD_RESET_TTL_MINUTES * 60_000,
    );
    await this.recuperacaoRepository.criarNova(
      conta.id,
      hashToken(token),
      expiraEm,
      agora,
    );

    if (!this.mailProvider.isEnabled()) return;
    const baseUrl = frontendBaseUrl();
    if (!baseUrl) {
      console.error("[auth] recuperação de senha sem FRONTEND_URL configurada");
      return;
    }

    const url = `${baseUrl}/redefinir-senha?token=${token}`;
    try {
      await this.mailProvider.send({
        to: conta.email,
        subject: "Recuperação de senha MOVA",
        html: `<p>Recebemos uma solicitação de recuperação de senha.</p><p><a href="${url}">Redefinir senha</a></p><p>O link expira em ${env.PASSWORD_RESET_TTL_MINUTES} minutos.</p>`,
        text: `Redefina sua senha: ${url}\nO link expira em ${env.PASSWORD_RESET_TTL_MINUTES} minutos.`,
      });
    } catch (error) {
      // Falha do provider não pode virar oracle de existência; nunca logue o token.
      console.error(
        "[auth] falha ao enviar recuperação de senha:",
        error instanceof Error ? error.message : "erro desconhecido",
      );
    }
  }

  async redefinir(token: string, novaSenha: string): Promise<void> {
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    const consumido = await this.recuperacaoRepository.consumirComNovaSenha(
      hashToken(token),
      novaSenhaHash,
      this.agora(),
    );

    if (!consumido) throw new HttpError(400, TOKEN_INVALIDO_MESSAGE);
  }
}
