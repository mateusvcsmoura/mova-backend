import { Handler } from "express";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../schemas/conta.schema.js";
import {
  RecuperacaoSenhaService,
  RESET_PASSWORD_MESSAGE,
} from "../services/recuperacao-senha.js";

export class RecuperacaoSenhaController {
  constructor(private readonly service: RecuperacaoSenhaService) {}

  forgot: Handler = async (req, res, next) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body ?? {});
      await this.service.solicitar(email);
      return res.status(200).json({ result: { message: RESET_PASSWORD_MESSAGE } });
    } catch (error) {
      next(error);
    }
  };

  reset: Handler = async (req, res, next) => {
    try {
      const { token, novaSenha } = resetPasswordSchema.parse(req.body ?? {});
      await this.service.redefinir(token, novaSenha);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
