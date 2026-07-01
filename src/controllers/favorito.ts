import { Handler } from "express";

import { FavoritoService } from "../services/favorito.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createFavoritoSchema,
  favoritoVeiculoParamSchema,
} from "../schemas/favorito.schema.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class FavoritoController {
  constructor(private favoritoService: FavoritoService) {}

  create: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = createFavoritoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const favorito = await this.favoritoService.favoritar(
        req.user.id,
        result.data.idVeiculo,
      );
      return res.status(201).json({ result: favorito });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = favoritoVeiculoParamSchema.safeParse(
        req.params.id_veiculo,
      );
      if (!result.success) throw new HttpError(400, "ID inválido");

      await this.favoritoService.desfavoritar(req.user.id, result.data);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  index: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const pagination = getPaginationParams(req.query);
      const favoritos = await this.favoritoService.listar(
        req.user.id,
        pagination,
      );

      return res.status(200).json({
        result: favoritos.data,
        pagination: toPaginationMeta(favoritos),
      });
    } catch (error) {
      next(error);
    }
  };

  verificar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = favoritoVeiculoParamSchema.safeParse(
        req.params.id_veiculo,
      );
      if (!result.success) throw new HttpError(400, "ID inválido");

      const verificacao = await this.favoritoService.verificar(
        req.user.id,
        result.data,
      );
      return res.status(200).json({ result: verificacao });
    } catch (error) {
      next(error);
    }
  };
}
