import { Handler } from "express";

import { PreferenciaNotificacaoService } from "../services/preferencia-notificacao.js";
import { HttpError } from "../errors/HttpError.js";
import { definirPreferenciaSchema } from "../schemas/preferencia-notificacao.schema.js";

export class PreferenciaNotificacaoController {
  constructor(private service: PreferenciaNotificacaoService) {}

  listar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const result = await this.service.listar(req.user.id, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  definir: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const parsed = definirPreferenciaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.format() });
      }
      const result = await this.service.definir(
        req.user.id,
        req.user,
        parsed.data,
      );
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };
}
