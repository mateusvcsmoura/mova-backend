import { LocadorService } from "../services/locador.js";
import { Handler, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";
import { createLocadorSchema } from "../schemas/locador.schema.js";

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
      const { id } = req.params;
      if (id && typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

      const locador = await this.locadorService.findById(id);

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
    try {
      const { id } = req.params;
      if (id && typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

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
      const { id } = req.params;
      if (id && typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

      await this.locadorService.delete(id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
