import { Handler } from "express";

import { InteresseVeiculoService } from "../services/interesse-veiculo.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createInteresseSchema,
  interesseVeiculoParamSchema,
} from "../schemas/interesse.schema.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class InteresseController {
  constructor(private interesseService: InteresseVeiculoService) {}

  create: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = createInteresseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const interesse = await this.interesseService.registrar(
        req.user.id,
        result.data.idVeiculo,
      );
      return res.status(201).json({ result: interesse });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = interesseVeiculoParamSchema.safeParse(
        req.params.id_veiculo,
      );
      if (!result.success) throw new HttpError(400, "ID inválido");

      await this.interesseService.cancelar(req.user.id, result.data);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  index: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const pagination = getPaginationParams(req.query);
      const interesses = await this.interesseService.listar(
        req.user.id,
        pagination,
      );

      return res.status(200).json({
        result: interesses.data,
        pagination: toPaginationMeta(interesses),
      });
    } catch (error) {
      next(error);
    }
  };
}
