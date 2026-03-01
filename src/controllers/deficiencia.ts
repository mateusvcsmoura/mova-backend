import { Handler, NextFunction } from "express";
import { DeficienciaService } from "../services/deficiencia.js";
import { HttpError } from "../errors/HttpError.js";
import { createDeficienciaSchema } from "../schemas/deficiencia.schema.js";

export class DeficienciaController {
  constructor(private readonly deficienciaService: DeficienciaService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const deficiencias = await this.deficienciaService.findAll();

      return res.status(200).json({ result: deficiencias });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

      const deficiencia = await this.deficienciaService.findById(id);

      return res.status(200).json({ result: deficiencia });
    } catch (error) {
      next(error);
    }
  };

  findByDescription: Handler = async (req, res, next: NextFunction) => {
    try {
      const { descricao } = req.query;

      if (typeof descricao !== "string") {
        throw new HttpError(400, "Descrição deve ser uma string");
      }

      const deficiencia =
        await this.deficienciaService.findByDescription(descricao);

      return res.status(200).json({ result: deficiencia });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = createDeficienciaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const deficiencia = await this.deficienciaService.create(result.data);

      return res.status(201).json({ result: deficiencia });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

      const result = createDeficienciaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const deficiencia = await this.deficienciaService.update(id, result.data);

      return res.status(200).json({ result: deficiencia });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        throw new HttpError(400, "ID deve ser uma string");
      }

      await this.deficienciaService.delete(id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
