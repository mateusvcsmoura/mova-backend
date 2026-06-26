import { Handler } from "express";
import { z } from "zod";

import { AvaliacaoService } from "../services/avaliacao.js";
import { HttpError } from "../errors/HttpError.js";
import { createAvaliacaoSchema } from "../schemas/avaliacao.schema.js";

export class AvaliacaoController {
  constructor(private avaliacaoService: AvaliacaoService) {}

  create: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = createAvaliacaoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const avaliacao = await this.avaliacaoService.criar(
        result.data,
        req.user,
      );
      return res.status(201).json({ result: avaliacao });
    } catch (error) {
      next(error);
    }
  };

  findByReserva: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = z.string().uuid().safeParse(req.params.id_reserva);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const avaliacao = await this.avaliacaoService.findByReserva(
        result.data,
        req.user,
      );
      return res.status(200).json({ result: avaliacao });
    } catch (error) {
      next(error);
    }
  };
}
