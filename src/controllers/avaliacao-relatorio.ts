import { Handler } from "express";

import { AvaliacaoRelatorioService } from "../services/avaliacao-relatorio.js";
import { HttpError } from "../errors/HttpError.js";
import { avaliacaoRelatorioQuerySchema } from "../schemas/avaliacao-relatorio.schema.js";

export class AvaliacaoRelatorioController {
  constructor(private relatorioService: AvaliacaoRelatorioService) {}

  dashboard: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = avaliacaoRelatorioQuerySchema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      // idLocador vem do token (req.user.id) — o cliente nunca informa o dono.
      const dashboard = await this.relatorioService.gerarDashboard(
        req.user.id,
        result.data,
      );
      return res.status(200).json({ result: dashboard });
    } catch (error) {
      next(error);
    }
  };
}
