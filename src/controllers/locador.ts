import { LocadorService } from "../services/locador.js";
import { Handler, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";
import { createLocadorSchema, updateLocadorSchema } from "../schemas/locador.schema.js";
import { z } from "zod";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class LocadorController {
  constructor(private readonly locadorService: LocadorService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const pagination = getPaginationParams(req.query);
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const locadores = await this.locadorService.findAll(pagination, req.user);

      return res.status(200).json({
        result: locadores.data,
        pagination: toPaginationMeta(locadores),
      });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      if (!req.user) throw new HttpError(401, "Não autenticado");
      const locador = await this.locadorService.findById(result.data, req.user);

      return res.status(200).json({ result: locador });
    } catch (error) {
      next(error);
    }
  };

  findByCnpjOrEmpresa: Handler = async (req, res, next: NextFunction) => {
    const { cnpj, empresa } = req.query;

    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      if (cnpj && typeof cnpj === "string") {
        const locador = await this.locadorService.findByCnpj(cnpj, req.user);
        return res.status(200).json({ result: locador });
      }

      const pagination = getPaginationParams(req.query);

      if (empresa && typeof empresa === "string") {
        const locadores = await this.locadorService.findByEmpresa(
          empresa,
          pagination, req.user,
        );
        return res.status(200).json({
          result: locadores.data,
          pagination: toPaginationMeta(locadores),
        });
      }

      const locadores = await this.locadorService.findAll(pagination, req.user);
      return res.status(200).json({
        result: locadores.data,
        pagination: toPaginationMeta(locadores),
      });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = createLocadorSchema.parse(req.body);

      const data = result;
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const locador = await this.locadorService.create(data, req.user);

      return res.status(201).json({ result: locador });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next: NextFunction) => {
    if (!req.params || !req.body)
      throw new HttpError(400, "Parâmetros ou corpo da requisição ausentes");

    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "ID inválido");
      }

      const id = parsedId.data;

      const result = updateLocadorSchema.parse(req.body);

      const data = result;
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const locador = await this.locadorService.update(id, data, req.user);

      return res.status(200).json({ result: locador });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      if (!req.user) throw new HttpError(401, "Não autenticado");
      await this.locadorService.delete(result.data, req.user);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
