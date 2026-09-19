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
      const parsed = definirPreferenciaSchema.parse(req.body);
      const result = await this.service.definir(
        req.user.id,
        req.user,
        parsed,
      );
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };
}
