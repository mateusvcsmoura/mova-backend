import { LocadorService } from "../services/locador.js";
import { Handler, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";
import { createLocadorSchema } from "../schemas/locador.schema.js";
import { z } from "zod";

export class LocadorController {
  constructor(private readonly locadorService: LocadorService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const locadores = await this.locadorService.findAll();

      return res.status(200).json({ result: locadores });
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

      const locador = await this.locadorService.findById(result.data);

      return res.status(200).json({ result: locador });
    } catch (error) {
      next(error);
    }
  };

  findByCnpjOrEmpresa: Handler = async (req, res, next: NextFunction) => {
    const { cnpj, empresa } = req.query;

    try {
      if (cnpj && typeof cnpj === "string") {
        const locador = await this.locadorService.findByCnpj(cnpj);
        return res.status(200).json({ result: locador });
      }

      if (empresa && typeof empresa === "string") {
        const locadores = await this.locadorService.findByEmpresa(empresa);
        return res.status(200).json({ result: locadores });
      }

      const locadores = await this.locadorService.findAll();
      return res.status(200).json({ result: locadores });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = createLocadorSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const locador = await this.locadorService.create(data);

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

      const result = createLocadorSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const locador = await this.locadorService.update(id, data);

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

      await this.locadorService.delete(result.data);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
