import { Handler, NextFunction } from "express";
import { z } from "zod";
import { HttpError } from "../errors/HttpError.js";
import { createLocatarioSchema, updateLocatarioSchema } from "../schemas/locatario.schema.js";
import { LocatarioService } from "../services/locatario.js";
import { getPaginationParams, toPaginationMeta } from "../shared/pagination.js";

export class LocatarioController {
  constructor(private readonly locatarioService: LocatarioService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const pagination = getPaginationParams(req.query);
      const locatarios = await this.locatarioService.findAll(pagination, req.user);

      return res.status(200).json({
        result: locatarios.data,
        pagination: toPaginationMeta(locatarios),
      });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const locatario = await this.locatarioService.findById(result.data, req.user);
      return res.status(200).json({ result: locatario });
    } catch (error) {
      next(error);
    }
  };

  findByCpfOrCnh: Handler = async (req, res, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const { cpf, cnh } = req.query;

      if (cpf && typeof cpf === "string") {
        const locatario = await this.locatarioService.findByCpf(cpf, req.user);
        return res.status(200).json({ result: locatario });
      }

      if (cnh && typeof cnh === "string") {
        const locatario = await this.locatarioService.findByCnh(cnh, req.user);
        return res.status(200).json({ result: locatario });
      }

      const pagination = getPaginationParams(req.query);
      const locatarios = await this.locatarioService.findAll(pagination, req.user);
      return res.status(200).json({
        result: locatarios.data,
        pagination: toPaginationMeta(locatarios),
      });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const data = createLocatarioSchema.parse(req.body);
      const locatario = await this.locatarioService.create(data, req.user);
      return res.status(201).json({ result: locatario });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next: NextFunction) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const data = updateLocatarioSchema.parse(req.body);
      const locatario = await this.locatarioService.update(parsedId.data, data, req.user);
      return res.status(200).json({ result: locatario });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");
      if (!req.user) throw new HttpError(401, "Não autenticado");

      await this.locatarioService.delete(result.data, req.user);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
