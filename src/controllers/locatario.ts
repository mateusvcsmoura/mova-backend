import { LocatarioService } from "../services/locatario.js";
import { Handler, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";
import {
  createLocatarioSchema,
  updateLocatarioSchema,
} from "../schemas/locatario.schema.js";

export class LocatarioController {
  constructor(private readonly locatarioService: LocatarioService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const locatarios = await this.locatarioService.findAll();

      return res.status(200).json({ result: locatarios });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    if (!req.params) throw new HttpError(400, "Parâmetros de rota ausentes");

    try {
      const { id } = req.params;

      if (id && typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

      const locatario = await this.locatarioService.findById(id);

      return res.status(200).json({ result: locatario });
    } catch (error) {
      next(error);
    }
  };

  findByCpfOrCnh: Handler = async (req, res, next: NextFunction) => {
    if (!req.query) throw new HttpError(400, "Parâmetros de consulta ausentes");

    try {
      const { cpf, cnh } = req.query;

      if (cpf && typeof cpf === "string") {
        const locatario = await this.locatarioService.findByCpf(cpf);
        return res.status(200).json({ result: locatario });
      }

      if (cnh && typeof cnh === "string") {
        const locatario = await this.locatarioService.findByCnh(cnh);
        return res.status(200).json({ result: locatario });
      }

      const locadarios = await this.locatarioService.findAll();
      return res.status(200).json({ result: locadarios });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = createLocatarioSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const locatario = await this.locatarioService.create(data);

      return res.status(201).json({ result: locatario });
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

      const result = updateLocatarioSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const locatario = await this.locatarioService.update(id, data);

      return res.status(200).json({ result: locatario });
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

      await this.locatarioService.delete(id);
    } catch (error) {
      next(error);
    }
  };
}
