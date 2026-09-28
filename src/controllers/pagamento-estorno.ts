import { Handler } from "express";
import { z } from "zod";

import { HttpError } from "../errors/HttpError.js";
import { PagamentoEstornoService } from "../services/pagamento-estorno.js";

export class PagamentoEstornoController {
  constructor(private readonly service: PagamentoEstornoService) {}

  consultar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = z.string().uuid().parse(req.params.id);
      const result = await this.service.consultar(id, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };
}
