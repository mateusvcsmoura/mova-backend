import { Handler, NextFunction } from "express";
import { ContaService } from "../services/conta.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createContaSchema,
  updateContaSchema,
} from "../schemas/conta.schema.js";

export class ContaController {
  constructor(private readonly contaService: ContaService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const contas = await this.contaService.findAll();

      return res.status(200).json({ result: contas });
    } catch (error) {
      next(error);
    }
  };

  findByEmail: Handler = async (req, res, next: NextFunction) => {
    if (!req.query) throw new HttpError(400, "Parâmetros de consulta ausentes");

    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        throw new HttpError(400, "Email inválido ou não informado");
      }
      const conta = await this.contaService.findByEmail(email);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    if (!req.params) throw new HttpError(400, "Parâmetros ausentes");

    try {
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new HttpError(400, "ID inválido ou não informado");
      }

      const conta = await this.contaService.findById(id);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const result = createContaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const conta = await this.contaService.create(data);

      return res.status(201).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next: NextFunction) => {
    if (!req.params || !req.body)
      throw new HttpError(400, "Parâmetros ou corpo da requisição ausentes");

    try {
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new HttpError(400, "ID inválido ou não informado");
      }

      const result = updateContaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const conta = await this.contaService.update(id, data);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };
}
