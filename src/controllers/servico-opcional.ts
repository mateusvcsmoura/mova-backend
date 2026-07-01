import { Handler } from "express";
import { z } from "zod";

import { ServicoOpcionalService } from "../services/servico-opcional.js";
import { HttpError } from "../errors/HttpError.js";
import { servicoOpcionalQuerySchema } from "../schemas/servico-opcional.schema.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class ServicoOpcionalController {
  constructor(private readonly servicoOpcionalService: ServicoOpcionalService) {}

  index: Handler = async (req, res, next) => {
    try {
      const parsedQuery = servicoOpcionalQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ errors: parsedQuery.error.format() });
      }

      const pagination = getPaginationParams(req.query);

      // Por padrão lista apenas os serviços disponíveis (ativos). Permite
      // ?ativo=false para inspeção administrativa do catálogo completo.
      const filters = {
        ativo: parsedQuery.data.ativo ?? true,
      };

      const servicos = await this.servicoOpcionalService.list(
        filters,
        pagination,
      );

      return res.status(200).json({
        result: servicos.data,
        pagination: toPaginationMeta(servicos),
      });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const servico = await this.servicoOpcionalService.findById(result.data);
      return res.status(200).json({ result: servico });
    } catch (error) {
      next(error);
    }
  };
}
